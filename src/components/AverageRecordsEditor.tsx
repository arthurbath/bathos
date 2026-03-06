import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGridAddFormAffixInput } from '@/components/ui/data-grid-add-form-affix-input';
import { DataGridAddFormLabel } from '@/components/ui/data-grid-add-form-label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DEFAULT_CURRENT_PERIOD_HANDLING,
  getAverageCalculationDetails,
  type BudgetAverageRecord,
  type BudgetCurrentPeriodHandling,
  type BudgetValueType,
} from '@/lib/budgetAveraging';
import { cn } from '@/lib/utils';

interface AverageRecordsEditorProps {
  valueType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>;
  records: BudgetAverageRecord[];
  onChange: (records: BudgetAverageRecord[]) => void;
  currentPeriodHandling?: BudgetCurrentPeriodHandling;
  onCurrentPeriodHandlingChange?: (value: BudgetCurrentPeriodHandling) => void;
  disabled?: boolean;
  averageLabel?: string;
  autoFocusAddButton?: boolean;
  onSubmitFromAmountEnter?: () => void;
  currentDate?: Date;
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseDateInputValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function buildRecordFromDate(date: Date, amount: number, valueType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>): BudgetAverageRecord {
  return {
    year: date.getFullYear(),
    month: valueType === 'monthly_averaged' ? date.getMonth() + 1 : null,
    amount,
    date: toDateInputValue(date),
  };
}

function getRecordDate(record: BudgetAverageRecord, valueType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>): Date {
  const parsed = parseDateInputValue(record.date);
  if (parsed) return parsed;
  return new Date(record.year, valueType === 'monthly_averaged' ? ((record.month ?? 1) - 1) : 0, 1);
}

function buildDefaultRecord(valueType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>): BudgetAverageRecord {
  return buildRecordFromDate(new Date(), 0, valueType);
}

function DateRecordPicker({
  rowIndex,
  record,
  valueType,
  disabled,
  onChange,
}: {
  rowIndex: number;
  record: BudgetAverageRecord;
  valueType: Extract<BudgetValueType, 'monthly_averaged' | 'yearly_averaged'>;
  disabled: boolean;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = getRecordDate(record, valueType);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);
  const selectedDateKey = record.date ?? `${record.year}-${record.month ?? 1}`;

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [open, selectedDateKey]);

  const scheduleTriggerFocusRestore = () => {
    window.setTimeout(() => {
      window.setTimeout(() => {
        triggerRef.current?.focus();
      }, 0);
    }, 0);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && shouldRestoreFocusRef.current) {
          shouldRestoreFocusRef.current = false;
          scheduleTriggerFocusRestore();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          data-average-record-primary-input="true"
          data-average-record-row={rowIndex}
          className={cn(
            'h-9 w-full justify-between border-[hsl(var(--grid-sticky-line))] bg-background px-3 text-left text-sm font-normal',
            'hover:bg-background',
          )}
        >
          <span>{format(selectedDate, 'MMM d, yyyy')}</span>
          <CalendarIcon className="ml-2 h-4 w-4 shrink-0 text-foreground opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(nextDate) => {
            if (!nextDate) return;
            shouldRestoreFocusRef.current = true;
            onChange(nextDate);
            setOpen(false);
            scheduleTriggerFocusRestore();
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function AverageRecordsEditor({
  valueType,
  records,
  onChange,
  currentPeriodHandling = DEFAULT_CURRENT_PERIOD_HANDLING,
  onCurrentPeriodHandlingChange,
  disabled = false,
  averageLabel,
  autoFocusAddButton = false,
  onSubmitFromAmountEnter,
  currentDate = new Date(),
}: AverageRecordsEditorProps) {
  const modeLabel = valueType === 'monthly_averaged' ? 'month' : 'year';
  const defaultAverageLabel = valueType === 'monthly_averaged' ? 'Monthly average' : 'Yearly average';
  const periodLabel = valueType === 'monthly_averaged' ? 'month' : 'year';
  const periodLabelPlural = `${periodLabel}s`;
  const currentPeriodCheckboxLabel = `Count records from the current ${periodLabel} toward average`;
  const currentPeriodTooltip = `If you plan to track multiple records per ${periodLabel} and track them as they happen rather than at the end of the ${periodLabel}, including the records from the in-progress ${periodLabel} in the average will artificially deflate the average. Excluding the records from the in-progress ${periodLabel} prevents that deflation.`;
  const {
    amount: computedAverage,
    includedPeriodCount,
  } = getAverageCalculationDetails(valueType, records, currentPeriodHandling, currentDate);
  const computedMonthlyAverageFromYearly = computedAverage / 12;
  const [blankAmountRows, setBlankAmountRows] = useState<number[]>([]);
  const shouldFocusNewestRowRef = useRef(false);
  const pendingPrimaryInputFocusRowRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAppliedInitialFocusRef = useRef(false);

  useEffect(() => {
    setBlankAmountRows((previous) => {
      const retained = previous.filter(
        (rowIndex) => rowIndex >= 0 && rowIndex < records.length && records[rowIndex]?.amount === 0,
      );
      if (records.length === 1 && records[0]?.amount === 0 && !retained.includes(0)) {
        return [0, ...retained];
      }
      return retained;
    });
  }, [records]);

  useEffect(() => {
    if (!autoFocusAddButton || disabled || hasAppliedInitialFocusRef.current) return;
    hasAppliedInitialFocusRef.current = true;
    const timer = window.setTimeout(() => {
      addButtonRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoFocusAddButton, disabled]);

  useEffect(() => {
    if (!shouldFocusNewestRowRef.current || disabled) return;
    shouldFocusNewestRowRef.current = false;

    const timer = window.setTimeout(() => {
      const rowPrimaryInput = containerRef.current?.querySelector<HTMLElement>(
        '[data-average-record-primary-input="true"][data-average-record-row="0"]',
      );
      rowPrimaryInput?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [disabled, records]);

  useEffect(() => {
    if (pendingPrimaryInputFocusRowRef.current == null || disabled) return;
    const rowIndex = pendingPrimaryInputFocusRowRef.current;
    pendingPrimaryInputFocusRowRef.current = null;

    const timer = window.setTimeout(() => {
      const primaryInput = containerRef.current?.querySelector<HTMLElement>(
        `[data-average-record-primary-input="true"][data-average-record-row="${rowIndex}"]`,
      );
      primaryInput?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [disabled, records]);

  const handleAddRecord = () => {
    shouldFocusNewestRowRef.current = true;
    setBlankAmountRows((previous) => [0, ...previous.map((rowIndex) => rowIndex + 1)]);
    onChange([buildDefaultRecord(valueType), ...records]);
  };

  const handleRemoveRecord = (index: number) => {
    if (records.length === 1) {
      pendingPrimaryInputFocusRowRef.current = 0;
      onChange([buildDefaultRecord(valueType)]);
      setBlankAmountRows([0]);
      return;
    }

    pendingPrimaryInputFocusRowRef.current = index === 0 ? 0 : index - 1;
    setBlankAmountRows((previous) =>
      previous
        .filter((rowIndex) => rowIndex !== index)
        .map((rowIndex) => (rowIndex > index ? rowIndex - 1 : rowIndex)),
    );
    onChange(records.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleDateChange = (index: number, date: Date) => {
    pendingPrimaryInputFocusRowRef.current = index;
    onChange(records.map((record, rowIndex) => (
      rowIndex === index ? buildRecordFromDate(date, record.amount, valueType) : record
    )));
  };

  const handleAmountChange = (index: number, amountValue: string) => {
    if (amountValue.trim() === '') {
      setBlankAmountRows((previous) => (previous.includes(index) ? previous : [...previous, index]));
      onChange(records.map((record, rowIndex) => (
        rowIndex === index ? { ...record, amount: 0 } : record
      )));
      return;
    }

    setBlankAmountRows((previous) => previous.filter((rowIndex) => rowIndex !== index));
    const amount = Number(amountValue);
    onChange(records.map((record, rowIndex) => (
      rowIndex === index ? { ...record, amount: Number.isFinite(amount) ? amount : 0 } : record
    )));
  };

  return (
    <div ref={containerRef} className="space-y-2.5">
      <div className="flex items-center justify-between">
        <DataGridAddFormLabel>Records</DataGridAddFormLabel>
        <Button
          ref={addButtonRef}
          type="button"
          variant="outline-success"
          size="sm"
          className="w-9"
          onClick={handleAddRecord}
          disabled={disabled}
          aria-label={`Add ${modeLabel} record`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">No records yet. Add one or more records to compute the average.</p>
      ) : (
        <div className="space-y-2">
          {records.map((record, index) => (
            <div key={`${record.date ?? `${record.year}-${record.month ?? 'year'}`}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
              <div>
                <DateRecordPicker
                  rowIndex={index}
                  record={record}
                  valueType={valueType}
                  disabled={disabled}
                  onChange={(date) => handleDateChange(index, date)}
                />
              </div>
              <div>
                <DataGridAddFormAffixInput
                  prefix="$"
                  value={blankAmountRows.includes(index) ? '' : String(record.amount)}
                  onChange={(event) => handleAmountChange(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || disabled || !onSubmitFromAmountEnter) return;
                    event.preventDefault();
                    onSubmitFromAmountEnter();
                  }}
                  disabled={disabled}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline-warning"
                size="sm"
                className="w-9 p-0 self-end"
                onClick={() => handleRemoveRecord(index)}
                disabled={disabled}
                aria-label={records.length === 1 ? `Clear ${modeLabel} record` : `Remove ${modeLabel} record ${index + 1}`}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`average-current-period-${valueType}`}
          checked={currentPeriodHandling === 'include_current_period'}
          onCheckedChange={(checked) => onCurrentPeriodHandlingChange?.(checked ? 'include_current_period' : 'exclude_current_period_until_closed')}
          disabled={disabled || !onCurrentPeriodHandlingChange}
        />
        <DataGridAddFormLabel
          htmlFor={`average-current-period-${valueType}`}
          tooltip={currentPeriodTooltip}
          className="leading-5"
        >
          {currentPeriodCheckboxLabel}
        </DataGridAddFormLabel>
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <div>
          {(averageLabel ?? defaultAverageLabel)}: <span className="tabular-nums text-foreground">${computedAverage.toFixed(2)}</span>
          <span>{` from ${includedPeriodCount} included ${includedPeriodCount === 1 ? periodLabel : periodLabelPlural}`}</span>
        </div>
        {valueType === 'yearly_averaged' && (
          <div>
            Monthly average: <span className="tabular-nums text-foreground">${computedMonthlyAverageFromYearly.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
