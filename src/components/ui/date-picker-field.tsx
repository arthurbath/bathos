import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ControlDecoration } from '@/components/ui/control-decoration';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { focusAdjacentFormControl } from '@/platform/formInteractions';

const DATE_PICKER_ADVANCE_EVENT = 'bathos:date-picker-advance';

export function requestDatePickerAdvance(panel: HTMLElement): void {
  panel.dispatchEvent(new CustomEvent(DATE_PICKER_ADVANCE_EVENT));
}

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
  panelCommandScope?: string;
  decoration?: React.ReactNode;
  decorationClassName?: string;
  popoverPlacement?: 'anchored' | 'viewport-center';
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
  commandScope?: string;
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
  commandScope,
}: DatePickerPanelProps) {
  const selectedDate = parseDatePickerFieldValue(value);
  const minimumDate = parseDatePickerFieldValue(minDate);
  const calendarToday = parseDatePickerFieldValue(todayDate);
  const defaultFocusDate = selectedDate ?? minimumDate ?? calendarToday;
  const selectedDateTime = selectedDate?.valueOf();
  const minimumDateTime = minimumDate?.valueOf();
  const defaultFocusTime = defaultFocusDate?.valueOf();
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(
    () => getVisibleMonth(value, todayDate),
  );
  const [focusDate, setFocusDate] = React.useState<Date | undefined>(defaultFocusDate);
  const [focusRequestKey, setFocusRequestKey] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const clearButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    setVisibleMonth(getVisibleMonth(value, todayDate));
    setFocusDate(defaultFocusTime === undefined ? undefined : new Date(defaultFocusTime));
    setFocusRequestKey((requestKey) => requestKey + 1);
  }, [active, defaultFocusTime, todayDate, value]);

  const focusCalendarDate = React.useCallback((date: Date) => {
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setFocusDate(date);
    setFocusRequestKey((requestKey) => requestKey + 1);
  }, []);

  React.useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleAdvance = () => {
      const activeElement = document.activeElement;
      const focusedDateValue = activeElement instanceof HTMLElement
        ? activeElement.closest<HTMLButtonElement>(
          'button[name="day"][data-calendar-date]',
        )?.dataset.calendarDate
        : undefined;
      const advancingOverdueSelection = selectedDateTime !== undefined
        && minimumDateTime !== undefined
        && selectedDateTime < minimumDateTime
        && focusedDateValue === value;
      const currentDate = advancingOverdueSelection
        ? new Date(selectedDateTime)
        : parseDatePickerFieldValue(focusedDateValue)
          ?? focusDate
        ?? (defaultFocusTime === undefined ? undefined : new Date(defaultFocusTime));
      if (!currentDate) return;
      const nextDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + 1,
      );
      focusCalendarDate(nextDate);
      const visibleTarget = panel.querySelector<HTMLButtonElement>(
        `button[name="day"][data-calendar-date="${toDatePickerFieldValue(nextDate)}"]`,
      );
      if (visibleTarget && !visibleTarget.disabled) visibleTarget.focus();
    };
    panel.addEventListener(DATE_PICKER_ADVANCE_EVENT, handleAdvance);
    return () => panel.removeEventListener(DATE_PICKER_ADVANCE_EVENT, handleAdvance);
  }, [
    active,
    defaultFocusTime,
    focusCalendarDate,
    focusDate,
    minimumDateTime,
    selectedDateTime,
    value,
  ]);

  return (
    <div
      ref={panelRef}
      data-date-picker-panel
      data-date-picker-command-scope={commandScope}
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
        initialFocusDate={focusDate ?? defaultFocusDate}
        initialFocusRequestKey={focusRequestKey}
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
        <div className="border-t border-[hsl(var(--grid-sticky-line))] p-1">
          <Button
            ref={clearButtonRef}
            type="button"
            variant="clear"
            size="sm"
            data-date-picker-clear
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
  panelCommandScope,
  decoration,
  decorationClassName,
  popoverPlacement = 'anchored',
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
            'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-left text-base font-normal text-foreground  md:text-sm',
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
          <span className="min-w-0 flex-1 truncate">
            {selectedDate ? displayValue ?? format(selectedDate, displayFormat) : placeholder}
          </span>
          <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-foreground opacity-50" />
        </Button>
      </PopoverTrigger>
      {popoverPlacement === 'viewport-center' ? (
        <PopoverAnchor asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed left-1/2 top-1/2 h-px w-px"
            data-date-picker-viewport-anchor
          />
        </PopoverAnchor>
      ) : null}
      <PopoverContent
        className={cn(
          'w-auto p-0',
          popoverPlacement === 'viewport-center' && '-translate-y-1/2 animate-none',
        )}
        align={popoverPlacement === 'viewport-center' ? 'center' : popoverAlign}
        side={popoverPlacement === 'viewport-center' ? 'bottom' : undefined}
        sideOffset={popoverPlacement === 'viewport-center' ? 0 : undefined}
        avoidCollisions={popoverPlacement !== 'viewport-center'}
        data-date-picker-placement={popoverPlacement}
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
          commandScope={panelCommandScope}
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
