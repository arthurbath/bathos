import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { PersistentTooltipText, TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DataGrid, GRID_HEADER_TONE_CLASS, GRID_READONLY_TEXT_CLASS } from '@/components/ui/data-grid';
import { toMonthly, frequencyLabels, needsParam } from '@/lib/frequency';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import {
  GRID_ACTIONS_COLUMN_ID,
  GRID_ACTIONS_COLUMN_WIDTH,
  GRID_FIXED_COLUMNS,
  GRID_MIN_COLUMN_WIDTH,
  SUMMARY_GRID_DEFAULT_WIDTHS,
} from '@/lib/gridColumnWidths';
import { cn } from '@/lib/utils';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import type { FrequencyType } from '@/types/fairshare';

interface SummaryTabProps {
  incomes: Income[];
  expenses: Expense[];
  linkedAccounts: LinkedAccount[];
  partnerX: string;
  partnerY: string;
  userId?: string;
}

function $(v: number) { return `$${Math.round(v)}`; }

type BreakdownRow = {
  id: string;
  name: string;
  amount: number;
  frequencyType: FrequencyType;
  frequencyParam: number | null;
  benefitX: number;
  monthly: number;
  payer: string;
  benefitSplit: string;
  fairX: number;
  fairY: number;
  overUnderX: number;
  overUnderY: number;
};

const breakdownColumnHelper = createColumnHelper<BreakdownRow>();

function formatFrequencyDescription(type: FrequencyType, param: number | null) {
  const label = frequencyLabels[type];
  if (!needsParam(type) || param == null) return label;
  return label.split('X').join(String(param));
}

function formatOverUnder(value: number) {
  if (value > 0.5) return `+${$(value)}`;
  if (value < -0.5) return `-${$(Math.abs(value))}`;
  return '—';
}

function overUnderToneClass(value: number) {
  if (value > 0.5) return 'text-primary';
  if (value < -0.5) return 'text-[hsl(var(--destructive-text))]';
  return '';
}

export function SummaryTab({ incomes, expenses, linkedAccounts, partnerX, partnerY, userId }: SummaryTabProps) {
  const [hideFullSplits, setHideFullSplits] = useState(false);
  const [sorting, setSorting] = useState<SortingState>(() => {
    try {
      const raw = localStorage.getItem('summary_sorting');
      return raw ? JSON.parse(raw) : [{ id: 'name', desc: false }];
    } catch {
      return [{ id: 'name', desc: false }];
    }
  });
  useEffect(() => {
    localStorage.setItem('summary_sorting', JSON.stringify(sorting));
  }, [sorting]);

  const {
    columnSizing,
    columnSizingInfo,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'summary',
    defaults: SUMMARY_GRID_DEFAULT_WIDTHS,
    fixedColumnIds: GRID_FIXED_COLUMNS.summary,
  });

  const hasFullSplitExpenses = useMemo(
    () => expenses.some((exp) => exp.benefit_x === 100 || exp.benefit_x === 0),
    [expenses],
  );

  const { incomeX, incomeY, incomeRatioX } = useMemo(() => {
    const nextIncomeX = incomes
      .filter((i) => i.partner_label === 'X')
      .reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
    const nextIncomeY = incomes
      .filter((i) => i.partner_label === 'Y')
      .reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
    const totalIncome = nextIncomeX + nextIncomeY;
    return {
      incomeX: nextIncomeX,
      incomeY: nextIncomeY,
      incomeRatioX: totalIncome > 0 ? nextIncomeX / totalIncome : 0.5,
    };
  }, [incomes]);

  const payerByLinkedAccountId = useMemo(
    () => new Map(linkedAccounts.map((a) => [a.id, a.owner_partner])),
    [linkedAccounts],
  );

  const { breakdown, totalFairX, totalFairY, paidByX, paidByY } = useMemo(() => {
    let nextTotalFairX = 0;
    let nextTotalFairY = 0;
    let nextPaidByX = 0;
    let nextPaidByY = 0;

    const nextBreakdown: BreakdownRow[] = expenses
      .map((exp) => {
        const monthly = toMonthly(exp.amount, exp.frequency_type, exp.frequency_param ?? undefined);
        const bx = exp.benefit_x / 100;
        const by = 1 - bx;
        const wx = bx * incomeRatioX;
        const wy = by * (1 - incomeRatioX);
        const tw = wx + wy || 1;
        const fairX = monthly * (wx / tw);
        const fairY = monthly * (wy / tw);

        nextTotalFairX += fairX;
        nextTotalFairY += fairY;
        const payer = exp.linked_account_id ? payerByLinkedAccountId.get(exp.linked_account_id) : null;
        if (payer === 'X') nextPaidByX += monthly;
        else if (payer === 'Y') nextPaidByY += monthly;

        const paidX = payer === 'X' ? monthly : 0;
        const paidY = payer === 'Y' ? monthly : 0;

        return {
          id: exp.id,
          name: exp.name,
          amount: Number(exp.amount),
          frequencyType: exp.frequency_type,
          frequencyParam: exp.frequency_param,
          benefitX: exp.benefit_x,
          monthly,
          payer: payer === 'X' ? partnerX : payer === 'Y' ? partnerY : 'Unassigned',
          benefitSplit: `${exp.benefit_x}/${100 - exp.benefit_x}`,
          fairX,
          fairY,
          overUnderX: paidX - fairX,
          overUnderY: paidY - fairY,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      breakdown: nextBreakdown,
      totalFairX: nextTotalFairX,
      totalFairY: nextTotalFairY,
      paidByX: nextPaidByX,
      paidByY: nextPaidByY,
    };
  }, [expenses, incomeRatioX, payerByLinkedAccountId, partnerX, partnerY]);

  const filteredBreakdown = useMemo(
    () => breakdown.filter(row => !hideFullSplits || (row.benefitSplit !== '100/0' && row.benefitSplit !== '0/100')),
    [breakdown, hideFullSplits],
  );

  const columns = useMemo(() => [
    breakdownColumnHelper.accessor('name', {
      header: 'Name',
      size: SUMMARY_GRID_DEFAULT_WIDTHS.name,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => <span className="font-medium text-xs">{getValue()}</span>,
    }),
    breakdownColumnHelper.accessor('monthly', {
      header: 'Monthly',
      size: SUMMARY_GRID_DEFAULT_WIDTHS.monthly,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => $(getValue()),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
    }),
    breakdownColumnHelper.accessor('payer', {
      header: 'Payer',
      size: SUMMARY_GRID_DEFAULT_WIDTHS.payer,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => <span className="text-xs">{getValue()}</span>,
    }),
    breakdownColumnHelper.accessor('benefitSplit', {
      id: 'benefit',
      header: 'Benefit',
      size: SUMMARY_GRID_DEFAULT_WIDTHS.benefit,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => <span className="text-xs">{getValue()}</span>,
    }),
    breakdownColumnHelper.accessor('fairX', {
      id: 'fair_x',
      header: `Fair ${partnerX}`,
      size: SUMMARY_GRID_DEFAULT_WIDTHS.fair_x,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue, row }) => {
        const originalAmount = Number(row.original.amount);
        const shouldShowNormalizationStep = row.original.frequencyType !== 'monthly';
        const frequencyDescription = formatFrequencyDescription(row.original.frequencyType, row.original.frequencyParam);
        const monthly = row.original.monthly;
        const isAllToPartnerX = row.original.benefitX >= 100;
        const isAllToPartnerY = row.original.benefitX <= 0;
        const isSingleBeneficiary = isAllToPartnerX || isAllToPartnerY;
        const beneficiaryLabel = isAllToPartnerX ? partnerX : partnerY;
        const benefitX = row.original.benefitX / 100;
        const benefitY = 1 - benefitX;
        const isEvenBenefitSplit = Math.abs(row.original.benefitX - 50) < 0.0001;
        const incomeXRatio = incomeRatioX;
        const incomeYRatio = 1 - incomeXRatio;
        const weightX = benefitX * incomeXRatio;
        const weightY = benefitY * incomeYRatio;
        const totalWeight = weightX + weightY || 1;
        const normalizedShareX = weightX / totalWeight;
        const value = Number(getValue());
        const hasSingleStep = !shouldShowNormalizationStep && (isSingleBeneficiary || isEvenBenefitSplit);
        const stepPrefix = (step: number) => (hasSingleStep ? '' : `${step}. `);

        return (
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="max-w-[460px] text-xs tabular-nums"
            content={(
              <div className="space-y-1.5 text-left">
                <div className="font-medium">{partnerX} fair share, step by step:</div>
                {shouldShowNormalizationStep && (
                  <div>{stepPrefix(1)}Convert the original expense to its monthly equivalent: ${originalAmount.toFixed(2)} {frequencyDescription.toLowerCase()} converts to ${monthly.toFixed(2)} per month.</div>
                )}
                {isSingleBeneficiary ? (
                  <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Benefit split is {row.original.benefitX}/
                    {100 - row.original.benefitX}, so this expense is assigned entirely to {beneficiaryLabel}. {partnerX === beneficiaryLabel ? `${partnerX} gets 100% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).` : `${partnerX} gets 0% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).`}
                  </div>
                ) : isEvenBenefitSplit ? (
                  <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Benefit is exactly 50/50, so just multiply the monthly amount by {partnerX}&apos;s income ratio: ${monthly.toFixed(2)} × {(incomeXRatio * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                ) : (
                  <>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Calculate {partnerX}&apos;s weight by combining benefit and income share: {(benefitX * 100).toFixed(1)}% × {(incomeXRatio * 100).toFixed(1)}% = {weightX.toFixed(4)}.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 3 : 2)}Calculate total weight for both partners: {weightX.toFixed(4)} + {weightY.toFixed(4)} = {totalWeight.toFixed(4)}.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 4 : 3)}Convert {partnerX}&apos;s weight to a fraction of the total: {weightX.toFixed(4)} / {totalWeight.toFixed(4)} = {(normalizedShareX * 100).toFixed(2)}%.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 5 : 4)}Apply that fraction to the monthly amount: ${monthly.toFixed(2)} × {(normalizedShareX * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                  </>
                )}
              </div>
            )}
          >
            {$(value)}
          </PersistentTooltipText>
        );
      },
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
    }),
    breakdownColumnHelper.accessor('fairY', {
      id: 'fair_y',
      header: `Fair ${partnerY}`,
      size: SUMMARY_GRID_DEFAULT_WIDTHS.fair_y,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue, row }) => {
        const originalAmount = Number(row.original.amount);
        const shouldShowNormalizationStep = row.original.frequencyType !== 'monthly';
        const frequencyDescription = formatFrequencyDescription(row.original.frequencyType, row.original.frequencyParam);
        const monthly = row.original.monthly;
        const isAllToPartnerX = row.original.benefitX >= 100;
        const isAllToPartnerY = row.original.benefitX <= 0;
        const isSingleBeneficiary = isAllToPartnerX || isAllToPartnerY;
        const beneficiaryLabel = isAllToPartnerX ? partnerX : partnerY;
        const benefitX = row.original.benefitX / 100;
        const benefitY = 1 - benefitX;
        const isEvenBenefitSplit = Math.abs(row.original.benefitX - 50) < 0.0001;
        const incomeXRatio = incomeRatioX;
        const incomeYRatio = 1 - incomeXRatio;
        const weightX = benefitX * incomeXRatio;
        const weightY = benefitY * incomeYRatio;
        const totalWeight = weightX + weightY || 1;
        const normalizedShareY = weightY / totalWeight;
        const value = Number(getValue());
        const hasSingleStep = !shouldShowNormalizationStep && (isSingleBeneficiary || isEvenBenefitSplit);
        const stepPrefix = (step: number) => (hasSingleStep ? '' : `${step}. `);

        return (
          <PersistentTooltipText
            align="end"
            side="top"
            contentClassName="max-w-[460px] text-xs tabular-nums"
            content={(
              <div className="space-y-1.5 text-left">
                <div className="font-medium">{partnerY} fair share, step by step:</div>
                {shouldShowNormalizationStep && (
                  <div>{stepPrefix(1)}Convert the original expense to its monthly equivalent: ${originalAmount.toFixed(2)} {frequencyDescription.toLowerCase()} converts to ${monthly.toFixed(2)} per month.</div>
                )}
                {isSingleBeneficiary ? (
                  <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Benefit split is {row.original.benefitX}/
                    {100 - row.original.benefitX}, so this expense is assigned entirely to {beneficiaryLabel}. {partnerY === beneficiaryLabel ? `${partnerY} gets 100% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).` : `${partnerY} gets 0% of ${monthly.toFixed(2)} = ${value.toFixed(2)} (displayed as ${Math.round(value)}).`}
                  </div>
                ) : isEvenBenefitSplit ? (
                  <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Benefit is exactly 50/50, so just multiply the monthly amount by {partnerY}&apos;s income ratio: ${monthly.toFixed(2)} × {(incomeYRatio * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                ) : (
                  <>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 2 : 1)}Calculate {partnerY}&apos;s weight by combining benefit and income share: {(benefitY * 100).toFixed(1)}% × {(incomeYRatio * 100).toFixed(1)}% = {weightY.toFixed(4)}.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 3 : 2)}Calculate total weight for both partners: {weightX.toFixed(4)} + {weightY.toFixed(4)} = {totalWeight.toFixed(4)}.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 4 : 3)}Convert {partnerY}&apos;s weight to a fraction of the total: {weightY.toFixed(4)} / {totalWeight.toFixed(4)} = {(normalizedShareY * 100).toFixed(2)}%.</div>
                    <div>{stepPrefix(shouldShowNormalizationStep ? 5 : 4)}Apply that fraction to the monthly amount: ${monthly.toFixed(2)} × {(normalizedShareY * 100).toFixed(2)}% = ${value.toFixed(2)} (displayed as ${Math.round(value)}).</div>
                  </>
                )}
              </div>
            )}
          >
            {$(value)}
          </PersistentTooltipText>
        );
      },
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
    }),
    breakdownColumnHelper.accessor('overUnderX', {
      id: 'over_under_x',
      header: `Over/Under ${partnerX}`,
      size: SUMMARY_GRID_DEFAULT_WIDTHS.over_under_x,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <span className={cn('tabular-nums text-xs', overUnderToneClass(value))}>
            {formatOverUnder(value)}
          </span>
        );
      },
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
    }),
    breakdownColumnHelper.accessor('overUnderY', {
      id: 'over_under_y',
      header: `Over/Under ${partnerY}`,
      size: SUMMARY_GRID_DEFAULT_WIDTHS.over_under_y,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <span className={cn('tabular-nums text-xs', overUnderToneClass(value))}>
            {formatOverUnder(value)}
          </span>
        );
      },
      meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
    }),
    breakdownColumnHelper.display({
      id: GRID_ACTIONS_COLUMN_ID,
      header: '',
      size: GRID_ACTIONS_COLUMN_WIDTH,
      minSize: GRID_ACTIONS_COLUMN_WIDTH,
      maxSize: GRID_ACTIONS_COLUMN_WIDTH,
      enableResizing: false,
      enableSorting: false,
      meta: { headerClassName: 'px-0', cellClassName: 'px-0' },
      cell: () => null,
    }),
  ], [incomeRatioX, partnerX, partnerY]);

  const breakdownTable = useReactTable({
    data: filteredBreakdown,
    columns,
    state: { sorting, columnSizing, columnSizingInfo },
    enableColumnResizing: true,
    onSortingChange: setSorting,
    onColumnSizingChange,
    onColumnSizingInfoChange,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const totalExpenses = paidByX + paidByY;
  const settlement = paidByX - totalFairX; // positive = Y owes X
  const totalOverUnderX = paidByX - totalFairX;
  const totalOverUnderY = paidByY - totalFairY;

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="h-9 px-2 text-left font-medium">Metric</th>
                  <th className="h-9 px-2 text-right font-medium">{partnerX}</th>
                  <th className="h-9 px-2 text-right font-medium">{partnerY}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <th className="h-9 px-2 text-left font-medium">Total Paid</th>
                  <td className="h-9 px-2 text-right tabular-nums">{$(paidByX)}</td>
                  <td className="h-9 px-2 text-right tabular-nums">{$(paidByY)}</td>
                </tr>
                <tr className="border-b">
                  <th className="h-9 px-2 text-left font-medium">Fair Share</th>
                  <td className="h-9 px-2 text-right tabular-nums">{$(totalFairX)}</td>
                  <td className="h-9 px-2 text-right tabular-nums">{$(totalFairY)}</td>
                </tr>
                <tr className="border-b">
                  <th className="h-9 px-2 text-left font-medium">Income Ratio</th>
                  <td className="h-9 px-2 text-right tabular-nums">{(incomeRatioX * 100).toFixed(0)}%</td>
                  <td className="h-9 px-2 text-right tabular-nums">{((1 - incomeRatioX) * 100).toFixed(0)}%</td>
                </tr>
                <tr className="border-b">
                  <th className="h-9 px-2 text-left font-medium">Monthly Expenses</th>
                  <td colSpan={2} className="h-9 px-2 text-right tabular-nums font-semibold">{$(totalExpenses)}</td>
                </tr>
                <tr>
                  <th className="h-9 px-2 text-left font-medium">
                    <PersistentTooltipText align="start" side="top" contentClassName="text-xs" content="Settlement is calculated as Paid - Fair Share.">
                      Monthly Settlement
                    </PersistentTooltipText>
                  </th>
                  <td colSpan={2} className="h-9 px-2 text-right tabular-nums">
                    {Math.abs(settlement) < 0.5
                      ? 'All square'
                      : settlement > 0
                        ? `${partnerY} pays ${partnerX} ${$(Math.abs(settlement))}`
                        : `${partnerX} pays ${partnerY} ${$(Math.abs(settlement))}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-expense breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Per-expense Breakdown</CardTitle>
            {hasFullSplitExpenses && (
              <div className="flex items-center gap-2">
                <Switch id="hide-full-splits" checked={hideFullSplits} onCheckedChange={setHideFullSplits} />
                <Label htmlFor="hide-full-splits" className="text-xs text-muted-foreground cursor-pointer">Hide 100/0</Label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2.5">
          {breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses to show.</p>
          ) : (
            <DataGrid
              table={breakdownTable}
              maxHeight="none"
              emptyMessage="No expenses to show."
              footer={(
                <tr className={`${GRID_HEADER_TONE_CLASS} ${GRID_READONLY_TEXT_CLASS}`}>
                  <td className={`h-9 align-middle font-semibold text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>Total</td>
                  <td className={`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>{$(totalExpenses)}</td>
                  <td colSpan={2} className={GRID_HEADER_TONE_CLASS} />
                  <td className={`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>{$(totalFairX)}</td>
                  <td className={`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`}>{$(totalFairY)}</td>
                  <td className={cn(`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`, overUnderToneClass(totalOverUnderX))}>
                    {formatOverUnder(totalOverUnderX)}
                  </td>
                  <td className={cn(`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2`, overUnderToneClass(totalOverUnderY))}>
                    {formatOverUnder(totalOverUnderY)}
                  </td>
                  <td className={GRID_HEADER_TONE_CLASS} />
                </tr>
              )}
            />
          )}
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
