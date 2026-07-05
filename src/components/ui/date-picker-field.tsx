import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function parseDatePickerFieldValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export function toDatePickerFieldValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getVisibleMonth(value: string | undefined): Date {
  const parsed = parseDatePickerFieldValue(value);
  if (parsed) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

interface DatePickerFieldProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  displayFormat?: string;
  popoverAlign?: 'start' | 'center' | 'end';
}

export const DatePickerField = React.forwardRef<HTMLButtonElement, DatePickerFieldProps>(({
  value,
  onValueChange,
  placeholder = 'Pick a date',
  displayFormat = 'MMM d, yyyy',
  popoverAlign = 'start',
  className,
  disabled,
  ...props
}, forwardedRef) => {
  const [open, setOpen] = React.useState(false);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => getVisibleMonth(value));
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedDate = parseDatePickerFieldValue(value);

  React.useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement);

  React.useEffect(() => {
    if (!open) return;
    setVisibleMonth(getVisibleMonth(value));
  }, [open, value]);

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
            'h-10 w-full justify-start rounded-md border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-left text-base font-normal text-foreground hover:bg-background hover:text-foreground md:text-sm',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
          {...props}
        >
          <span className="truncate">{selectedDate ? format(selectedDate, displayFormat) : placeholder}</span>
          <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-foreground opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={popoverAlign}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(date) => {
            if (!date) {
              setOpen(false);
              return;
            }
            onValueChange(toDatePickerFieldValue(date));
            setOpen(false);
            restoreTriggerFocus();
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
});

DatePickerField.displayName = 'DatePickerField';
