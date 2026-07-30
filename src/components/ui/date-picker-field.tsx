import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ControlDecoration } from '@/components/ui/control-decoration';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { focusAdjacentFormControl } from '@/platform/formInteractions';

export function parseDatePickerFieldValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export function toDatePickerFieldValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getVisibleMonth(value: string | undefined, fallbackValue?: string): Date {
  const parsed = parseDatePickerFieldValue(value);
  if (parsed) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const today = parseDatePickerFieldValue(fallbackValue) ?? new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

interface DatePickerFieldProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  displayFormat?: string;
  displayValue?: string;
  popoverAlign?: 'start' | 'center' | 'end';
  minDate?: string;
  todayDate?: string;
  clearable?: boolean;
  clearEnabled?: boolean;
  clearLabel?: string;
  decoration?: React.ReactNode;
  decorationClassName?: string;
}

export interface DatePickerPanelProps {
  value: string;
  onValueChange: (value: string) => void;
  onRequestClose: () => void;
  onTabExit?: (backwards: boolean) => void;
  minDate?: string;
  todayDate?: string;
  clearable?: boolean;
  clearEnabled?: boolean;
  clearLabel?: string;
  active?: boolean;
}

export function DatePickerPanel({
  value,
  onValueChange,
  onRequestClose,
  onTabExit,
  minDate,
  todayDate,
  clearable = false,
  clearEnabled,
  clearLabel = 'Clear',
  active = true,
}: DatePickerPanelProps) {
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(
    () => getVisibleMonth(value, todayDate),
  );
  const clearButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedDate = parseDatePickerFieldValue(value);
  const minimumDate = parseDatePickerFieldValue(minDate);
  const calendarToday = parseDatePickerFieldValue(todayDate);

  React.useEffect(() => {
    if (!active) return;
    setVisibleMonth(getVisibleMonth(value, todayDate));
  }, [active, todayDate, value]);

  return (
    <div
      data-date-picker-panel
      onKeyDownCapture={(event) => {
        if (event.key !== 'Tab' || !onTabExit) return;
        event.preventDefault();
        event.stopPropagation();
        onTabExit(event.shiftKey);
      }}
    >
      <Calendar
        mode="single"
        selected={selectedDate}
        disabled={minimumDate ? { before: minimumDate } : undefined}
        fromDate={minimumDate}
        month={visibleMonth}
        today={calendarToday}
        initialFocusDate={selectedDate ?? minimumDate ?? calendarToday}
        allowTabExit
        onMonthChange={setVisibleMonth}
        onDayGridExitDown={() => {
          if (clearButtonRef.current?.disabled) return false;
          clearButtonRef.current?.focus();
          return Boolean(clearButtonRef.current);
        }}
        onSelect={(date) => {
          if (date) onValueChange(toDatePickerFieldValue(date));
          onRequestClose();
        }}
        initialFocus
      />
      {clearable ? (
        <div className="border-t border-[hsl(var(--grid-sticky-line))] p-2">
          <Button
            ref={clearButtonRef}
            type="button"
            variant="clear"
            className="w-full justify-start gap-2 text-muted-foreground"
            disabled={clearEnabled === undefined ? !value : !clearEnabled}
            onClick={() => {
              onValueChange('');
              onRequestClose();
            }}
          >
            <X className="h-4 w-4" aria-hidden />
            {clearLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export const DatePickerField = React.forwardRef<HTMLButtonElement, DatePickerFieldProps>(({
  value,
  onValueChange,
  placeholder = 'Pick a date',
  displayFormat = 'MMM d, yyyy',
  displayValue,
  popoverAlign = 'start',
  minDate,
  todayDate,
  clearable = false,
  clearEnabled,
  clearLabel = 'Clear',
  decoration,
  decorationClassName,
  className,
  disabled,
  ...props
}, forwardedRef) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const tabExitDirectionRef = React.useRef<'forward' | 'backward' | null>(null);
  const selectedDate = parseDatePickerFieldValue(value);

  React.useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement);

  const restoreTriggerFocus = () => {
    window.setTimeout(() => {
      window.setTimeout(() => {
        triggerRef.current?.focus();
      }, 0);
    }, 0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-left text-base font-normal text-foreground enabled:hover:bg-background md:text-sm',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
          {...props}
          onKeyDown={(event) => {
            props.onKeyDown?.(event);
            if (event.defaultPrevented || !clearable || !value) return;
            if (event.key !== 'Backspace' && event.key !== 'Delete') return;
            event.preventDefault();
            onValueChange('');
          }}
        >
          {decoration ? (
            <ControlDecoration className={decorationClassName}>
              {decoration}
            </ControlDecoration>
          ) : null}
          <span className={cn('min-w-0 flex-1 truncate', decoration && 'ml-2')}>
            {selectedDate ? displayValue ?? format(selectedDate, displayFormat) : placeholder}
          </span>
          <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-foreground opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={popoverAlign}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          const direction = tabExitDirectionRef.current;
          if (!direction) return;
          event.preventDefault();
          tabExitDirectionRef.current = null;
          if (triggerRef.current) {
            focusAdjacentFormControl(triggerRef.current, direction === 'backward');
          }
        }}
      >
        <DatePickerPanel
          value={value}
          onValueChange={onValueChange}
          minDate={minDate}
          todayDate={todayDate}
          clearable={clearable}
          clearEnabled={clearEnabled}
          clearLabel={clearLabel}
          active={open}
          onRequestClose={() => {
            setOpen(false);
            restoreTriggerFocus();
          }}
          onTabExit={(backwards) => {
            tabExitDirectionRef.current = backwards ? 'backward' : 'forward';
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
});

DatePickerField.displayName = 'DatePickerField';
