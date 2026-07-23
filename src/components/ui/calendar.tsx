import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button as DayPickerButton,
  DayPicker,
  type DayProps,
  useDayRender,
} from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  allowTabExit?: boolean;
  initialFocusDate?: Date;
  onKeyDownCapture?: React.KeyboardEventHandler;
};

type CalendarViewMode = "day" | "month";
const CALENDAR_VIEWPORT_WIDTH_CLASS = "box-border w-[276px]";
const CALENDAR_DAY_VIEWPORT_CLASS = `${CALENDAR_VIEWPORT_WIDTH_CLASS} min-h-[318px]`;
const CALENDAR_CAPTION_CLASS = "flex justify-center pt-1 relative items-center";
const CALENDAR_NAV_CLASS = "space-x-1 flex items-center";
const CALENDAR_NAV_BUTTON_CLASS = "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100";
const CALENDAR_NAV_PREV_CLASS = "absolute left-1";
const CALENDAR_NAV_NEXT_CLASS = "absolute right-1";
const CALENDAR_HEADER_CLASS = "inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0";
const CALENDAR_HEADER_BUTTON_CLASS = `${CALENDAR_HEADER_CLASS} border border-transparent bg-transparent text-white transition-colors hover:bg-primary/10 hover:text-primary`;

function CalendarDay({ date, displayMonth }: DayProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dayRender = useDayRender(date, displayMonth, buttonRef);

  if (dayRender.isHidden) {
    return <div role="gridcell" />;
  }
  if (!dayRender.isButton) {
    return (
      <div
        {...dayRender.divProps}
        aria-current={dayRender.activeModifiers.today ? "date" : undefined}
      />
    );
  }
  return (
    <DayPickerButton
      name="day"
      ref={buttonRef}
      {...dayRender.buttonProps}
      aria-current={dayRender.activeModifiers.today ? "date" : undefined}
    />
  );
}

function getFocusableDayRows(root: HTMLElement): HTMLButtonElement[][] {
  return Array.from(root.querySelectorAll("tbody tr"))
    .map((row) => Array.from(row.querySelectorAll<HTMLButtonElement>('button[name="day"]')))
    .filter((row) => row.length > 0);
}

function focusCalendarArrowTarget(root: HTMLElement, activeElement: HTMLElement, key: string): boolean {
  const previousMonthButton = root.querySelector<HTMLButtonElement>('button[name="previous-month"]');
  const nextMonthButton = root.querySelector<HTMLButtonElement>('button[name="next-month"]');
  const captionButton = root.querySelector<HTMLButtonElement>('button[name="caption-month-year"]');
  const rows = getFocusableDayRows(root);

  if (activeElement.getAttribute("name") === "day") {
    const rowIndex = rows.findIndex((row) => row.includes(activeElement as HTMLButtonElement));
    if (rowIndex === -1) return false;
    const colIndex = rows[rowIndex].indexOf(activeElement as HTMLButtonElement);
    if (colIndex === -1) return false;

    let target: HTMLButtonElement | null | undefined;
    if (key === "ArrowLeft") {
      target = colIndex > 0 ? rows[rowIndex][colIndex - 1] : (rows[rowIndex - 1]?.at(-1) ?? previousMonthButton);
    } else if (key === "ArrowRight") {
      target = colIndex < rows[rowIndex].length - 1 ? rows[rowIndex][colIndex + 1] : (rows[rowIndex + 1]?.[0] ?? nextMonthButton);
    } else if (key === "ArrowUp") {
      target = rowIndex > 0
        ? rows[rowIndex - 1]?.[Math.min(colIndex, rows[rowIndex - 1].length - 1)]
        : (colIndex >= 2 && colIndex <= 4 ? captionButton : (colIndex >= 5 ? nextMonthButton : previousMonthButton));
    } else if (key === "ArrowDown") {
      target = rows[rowIndex + 1]?.[Math.min(colIndex, rows[rowIndex + 1].length - 1)];
    }

    if (!target) return false;
    target.focus();
    return true;
  }

  if (activeElement === previousMonthButton) {
    if (key === "ArrowRight" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowUp" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowDown" && rows[0]?.[0]) {
      rows[0][0].focus();
      return true;
    }
    return false;
  }

  if (activeElement === nextMonthButton) {
    if (key === "ArrowLeft" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowUp" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowDown" && rows[0]?.at(-1)) {
      rows[0].at(-1)?.focus();
      return true;
    }
    return false;
  }

  if (activeElement === captionButton) {
    if (key === "ArrowDown" && rows[0]?.[3]) {
      rows[0][3].focus();
      return true;
    }
    if (key === "ArrowLeft" && previousMonthButton) {
      previousMonthButton.focus();
      return true;
    }
    if (key === "ArrowRight" && nextMonthButton) {
      nextMonthButton.focus();
      return true;
    }
    return false;
  }

  return false;
}

function MonthPicker({
  year,
  activeMonth,
  minimumDate,
  onYearChange,
  onMonthSelect,
}: {
  year: number;
  activeMonth: number | null;
  minimumDate?: Date;
  onYearChange: (nextYear: number) => void;
  onMonthSelect: (nextMonthIndex: number) => void;
}) {
  const prevYearButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const nextYearButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const monthButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const pendingYearButtonFocusRef = React.useRef<"previous" | "next" | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pendingYearButtonFocusRef.current === "previous") {
        prevYearButtonRef.current?.focus();
      } else if (pendingYearButtonFocusRef.current === "next") {
        nextYearButtonRef.current?.focus();
      } else {
        const preferredMonth = activeMonth !== null
          && isMonthSelectable(year, activeMonth, minimumDate)
          ? activeMonth
          : firstSelectableMonthIndex(year, minimumDate);
        if (preferredMonth !== null) {
          monthButtonRefs.current[preferredMonth]?.focus();
        }
      }
      pendingYearButtonFocusRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMonth, minimumDate, year]);

  const focusMonthAt = (index: number) => {
    const candidate = monthButtonRefs.current[index];
    if (!candidate?.disabled) candidate.focus();
  };

  const pageYear = (position: "previous" | "next") => {
    const nextYear = position === "previous" ? year - 1 : year + 1;
    if (firstSelectableMonthIndex(nextYear, minimumDate) === null) return;
    pendingYearButtonFocusRef.current = position;
    onYearChange(nextYear);
  };

  const handleMonthGridKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, monthIndex: number) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const previousMonth = findSelectableMonth(monthIndex, -1, year, minimumDate);
      if (previousMonth !== null) focusMonthAt(previousMonth);
      else if (!prevYearButtonRef.current?.disabled) prevYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextMonth = findSelectableMonth(monthIndex, 1, year, minimumDate);
      if (nextMonth !== null) focusMonthAt(nextMonth);
      else nextYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const priorRowMonth = findSelectableMonth(monthIndex, -3, year, minimumDate);
      if (priorRowMonth !== null && priorRowMonth < monthIndex) focusMonthAt(priorRowMonth);
      else if (monthIndex % 3 === 2) nextYearButtonRef.current?.focus();
      else if (!prevYearButtonRef.current?.disabled) prevYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextRowMonth = findSelectableMonth(monthIndex, 3, year, minimumDate);
      if (nextRowMonth !== null && nextRowMonth > monthIndex) focusMonthAt(nextRowMonth);
      return;
    }
  };

  const handleYearButtonKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    position: "previous" | "next",
  ) => {
    if (event.key === "ArrowRight" && position === "previous") {
      event.preventDefault();
      nextYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && position === "next") {
      event.preventDefault();
      prevYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (position === "previous") focusMonthAt(0);
      else focusMonthAt(2);
    }
  };

  return (
    <div className={cn("mx-auto p-3", CALENDAR_VIEWPORT_WIDTH_CLASS)} data-calendar-month-picker="true">
      <div className="space-y-4">
        <div className={CALENDAR_CAPTION_CLASS} data-calendar-month-picker-caption="true">
          <div className={CALENDAR_HEADER_CLASS} data-calendar-month-picker-year-label="true">
            {year}
          </div>
          <div className={CALENDAR_NAV_CLASS} data-calendar-month-picker-nav="true">
            <button
              ref={prevYearButtonRef}
              type="button"
              name="previous-year"
              aria-label="Go to previous year"
              disabled={firstSelectableMonthIndex(year - 1, minimumDate) === null}
              className={cn(
                "rdp-button_reset rdp-button",
                buttonVariants({ variant: "clear" }),
                CALENDAR_NAV_BUTTON_CLASS,
                CALENDAR_NAV_PREV_CLASS,
              )}
              onClick={() => pageYear("previous")}
              onKeyDown={(event) => handleYearButtonKeyDown(event, "previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              ref={nextYearButtonRef}
              type="button"
              name="next-year"
              aria-label="Go to next year"
              className={cn(
                "rdp-button_reset rdp-button",
                buttonVariants({ variant: "clear" }),
                CALENDAR_NAV_BUTTON_CLASS,
                CALENDAR_NAV_NEXT_CLASS,
              )}
              onClick={() => pageYear("next")}
              onKeyDown={(event) => handleYearButtonKeyDown(event, "next")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const monthDate = new Date(year, monthIndex, 1);
            const isSelected = monthIndex === activeMonth;
            const isDisabled = !isMonthSelectable(year, monthIndex, minimumDate);
            return (
              <button
                key={monthIndex}
                ref={(element) => {
                  monthButtonRefs.current[monthIndex] = element;
                }}
                type="button"
                name="month"
                aria-label={format(monthDate, "MMMM yyyy")}
                disabled={isDisabled}
                className={cn(
                  buttonVariants({ variant: "clear" }),
                  "h-9 px-0",
                  isSelected && "border border-primary bg-primary/10 text-primary",
                  isDisabled && "text-muted-foreground opacity-50",
                )}
                onClick={() => onMonthSelect(monthIndex)}
                onKeyDown={(event) => handleMonthGridKeyDown(event, monthIndex)}
              >
                {format(monthDate, "MMM")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  allowTabExit = false,
  initialFocusDate,
  onKeyDownCapture,
  month,
  defaultMonth,
  today,
  fromDate,
  onMonthChange,
  components,
  ...props
}: CalendarProps) {
  const isControlledMonth = month !== undefined;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const initialMonth = clampMonthToMinimum(
    month ?? defaultMonth ?? today ?? new Date(),
    fromDate,
  );
  const [internalMonth, setInternalMonth] = React.useState<Date>(initialMonth);
  const baseMonth = isControlledMonth ? month : internalMonth;
  const displayMonth = React.useMemo(
    () => clampMonthToMinimum(baseMonth ?? new Date(), fromDate),
    [baseMonth, fromDate],
  );
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("day");
  const [monthPickerYear, setMonthPickerYear] = React.useState<number>(displayMonth.getFullYear());
  const [monthPickerActiveMonth, setMonthPickerActiveMonth] = React.useState<number | null>(displayMonth.getMonth());
  const [pendingDayFocusDate, setPendingDayFocusDate] = React.useState<Date | null>(null);
  const initialFocusTime = initialFocusDate?.valueOf();

  React.useEffect(() => {
    if (viewMode !== "month") return;
    setMonthPickerYear(displayMonth.getFullYear());
  }, [displayMonth, viewMode]);

  React.useEffect(() => {
    if (!pendingDayFocusDate || viewMode !== "day") return;
    const timer = window.setTimeout(() => {
      const targetButton = findDayButton(rootRef.current, pendingDayFocusDate);
      targetButton?.focus();
      setPendingDayFocusDate(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingDayFocusDate, viewMode]);

  React.useEffect(() => {
    if (initialFocusTime === undefined || viewMode !== "day") return;
    const timer = window.setTimeout(() => {
      findDayButton(rootRef.current, new Date(initialFocusTime))?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialFocusTime, viewMode]);

  const commitMonthChange = React.useCallback((nextMonth: Date) => {
    const normalized = clampMonthToMinimum(nextMonth, fromDate);
    if (!isControlledMonth) {
      setInternalMonth(normalized);
    }
    onMonthChange?.(normalized);
  }, [fromDate, isControlledMonth, onMonthChange]);

  const rootKeyDownCapture: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Tab" && !allowTabExit) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (viewMode === "day" && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const root = event.currentTarget as HTMLElement;
      const activeElement = event.target instanceof HTMLElement ? event.target : null;
      if (activeElement && focusCalendarArrowTarget(root, activeElement, event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    onKeyDownCapture?.(event);
  };

  return (
    <div ref={rootRef} data-calendar-root="true" onKeyDownCapture={rootKeyDownCapture}>
      {viewMode === "month" ? (
        <MonthPicker
          year={monthPickerYear}
          activeMonth={monthPickerActiveMonth}
          minimumDate={fromDate}
          onYearChange={(nextYear) => {
            setMonthPickerActiveMonth(null);
            setMonthPickerYear(nextYear);
          }}
          onMonthSelect={(nextMonthIndex) => {
            const nextMonth = new Date(monthPickerYear, nextMonthIndex, 1);
            commitMonthChange(nextMonth);
            setPendingDayFocusDate(firstSelectableDateInMonth(nextMonth, fromDate));
            setViewMode("day");
          }}
        />
      ) : (
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={displayMonth}
          defaultMonth={displayMonth}
          fromDate={fromDate}
          className={cn("p-3", CALENDAR_DAY_VIEWPORT_CLASS, className)}
          onMonthChange={commitMonthChange}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: CALENDAR_CAPTION_CLASS,
            caption_label: "text-sm font-medium",
            nav: CALENDAR_NAV_CLASS,
            nav_button: cn(
              buttonVariants({ variant: "clear" }),
              CALENDAR_NAV_BUTTON_CLASS,
            ),
            nav_button_previous: CALENDAR_NAV_PREV_CLASS,
            nav_button_next: CALENDAR_NAV_NEXT_CLASS,
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: cn(buttonVariants({ variant: "clear" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
            day_range_end: "day-range-end",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside:
              "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
            IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
            Day: CalendarDay,
            CaptionLabel: ({ displayMonth: captionMonth, id }) => (
              <button
                type="button"
                id={id}
                name="caption-month-year"
                aria-label={`Choose month and year, currently ${format(captionMonth, "MMMM yyyy")}`}
                className={CALENDAR_HEADER_BUTTON_CLASS}
                onClick={() => {
                  setMonthPickerYear(displayMonth.getFullYear());
                  setMonthPickerActiveMonth(displayMonth.getMonth());
                  setViewMode("month");
                }}
              >
                {format(captionMonth, "MMMM yyyy")}
              </button>
            ),
            ...components,
          }}
          {...props}
        />
      )}
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

function clampMonthToMinimum(value: Date, minimumDate?: Date): Date {
  const month = new Date(value.getFullYear(), value.getMonth(), 1);
  if (!minimumDate) return month;
  const minimumMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
  return month < minimumMonth ? minimumMonth : month;
}

function firstSelectableDateInMonth(month: Date, minimumDate?: Date): Date {
  if (
    minimumDate
    && month.getFullYear() === minimumDate.getFullYear()
    && month.getMonth() === minimumDate.getMonth()
  ) {
    return minimumDate;
  }
  return new Date(month.getFullYear(), month.getMonth(), 1);
}

function isMonthSelectable(year: number, monthIndex: number, minimumDate?: Date): boolean {
  if (!minimumDate) return true;
  const monthEnd = new Date(year, monthIndex + 1, 0);
  return monthEnd >= minimumDate;
}

function firstSelectableMonthIndex(year: number, minimumDate?: Date): number | null {
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (isMonthSelectable(year, monthIndex, minimumDate)) return monthIndex;
  }
  return null;
}

function findSelectableMonth(
  startIndex: number,
  step: number,
  year: number,
  minimumDate?: Date,
): number | null {
  let index = startIndex + step;
  while (index >= 0 && index <= 11) {
    if (isMonthSelectable(year, index, minimumDate)) return index;
    index += step < 0 ? -1 : 1;
  }
  return null;
}

function findDayButton(root: HTMLElement | null, date: Date): HTMLButtonElement | null {
  const buttons = Array.from(root?.querySelectorAll<HTMLButtonElement>('button[name="day"]') ?? []);
  return buttons.find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return button.textContent?.trim() === String(date.getDate())
      && label.includes(format(date, "MMMM"))
      && label.includes(String(date.getFullYear()));
  }) ?? buttons.find((button) => (
    button.textContent?.trim() === String(date.getDate())
    && !button.className.includes("day-outside")
  )) ?? null;
}
