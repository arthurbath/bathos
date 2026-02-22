import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DataGrid, GRID_HEADER_TONE_CLASS, GRID_READONLY_TEXT_CLASS } from '@/components/ui/data-grid';
import { toMonthly } from '@/lib/frequency';
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
  monthly: number;
  payer: string;
  benefitSplit: string;
  fairX: number;
  fairY: number;
  overUnderX: number;
  overUnderY: number;
};

const breakdownColumnHelper = createColumnHelper<BreakdownRow>();

function formatOverUnder(value: number) {
  if (value > 0.5) return `+${$(value)}`;
  if (value < -0.5) return `-${$(Math.abs(value))}`;
  return '—';
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
      cell: ({ getValue }) => $(getValue()),
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums text-xs' },
    }),
    breakdownColumnHelper.accessor('fairY', {
      id: 'fair_y',
      header: `Fair ${partnerY}`,
      size: SUMMARY_GRID_DEFAULT_WIDTHS.fair_y,
      minSize: GRID_MIN_COLUMN_WIDTH,
      cell: ({ getValue }) => $(getValue()),
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
          <span className={cn('tabular-nums text-xs', value > 0.5 ? 'text-primary' : value < -0.5 ? 'text-destructive' : '')}>
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
          <span className={cn('tabular-nums text-xs', value > 0.5 ? 'text-primary' : value < -0.5 ? 'text-destructive' : '')}>
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
  ], [partnerX, partnerY]);

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
    <div className="space-y-6">
      {/* Settlement callout */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-8">
          {Math.abs(settlement) < 0.5 ? (
            <p className="text-center text-xl font-semibold text-foreground">All square</p>
          ) : settlement > 0 ? (
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">Monthly settlement</p>
              <p className="text-3xl font-bold tracking-tight text-primary mt-1">
                {partnerY} pays {partnerX} {$(Math.abs(settlement))}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">Monthly settlement</p>
              <p className="text-3xl font-bold tracking-tight text-primary mt-1">
                {partnerX} pays {partnerY} {$(Math.abs(settlement))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div />
            <div className="font-medium text-center">Paid</div>
            <div className="font-medium text-center">Fair share</div>
            <div className="font-medium">{partnerX}</div>
            <div className="text-center">{$(paidByX)}</div>
            <div className="text-center">{$(totalFairX)}</div>
            <div className="font-medium">{partnerY}</div>
            <div className="text-center">{$(paidByY)}</div>
            <div className="text-center">{$(totalFairY)}</div>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total monthly expenses</span>
            <span>{$(totalExpenses)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Income ratio: {partnerX} {(incomeRatioX * 100).toFixed(0)}% / {partnerY} {((1 - incomeRatioX) * 100).toFixed(0)}%
          </p>
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
                  <td className={`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2 ${totalOverUnderX > 0.5 ? 'text-primary' : totalOverUnderX < -0.5 ? 'text-destructive' : ''}`}>
                    {formatOverUnder(totalOverUnderX)}
                  </td>
                  <td className={`h-9 align-middle text-right font-bold tabular-nums text-xs ${GRID_HEADER_TONE_CLASS} px-2 ${totalOverUnderY > 0.5 ? 'text-primary' : totalOverUnderY < -0.5 ? 'text-destructive' : ''}`}>
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
  );
}
