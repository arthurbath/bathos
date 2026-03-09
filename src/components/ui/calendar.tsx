import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
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
  onYearChange,
  onMonthSelect,
}: {
  year: number;
  activeMonth: number | null;
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
      } else if (activeMonth !== null) {
        monthButtonRefs.current[activeMonth]?.focus();
      }
      pendingYearButtonFocusRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMonth, year]);

  const focusMonthAt = (index: number) => {
    monthButtonRefs.current[index]?.focus();
  };

  const pageYear = (position: "previous" | "next") => {
    pendingYearButtonFocusRef.current = position;
    onYearChange(position === "previous" ? year - 1 : year + 1);
  };

  const handleMonthGridKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, monthIndex: number) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (monthIndex > 0) focusMonthAt(monthIndex - 1);
      else prevYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (monthIndex < 11) focusMonthAt(monthIndex + 1);
      else nextYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (monthIndex - 3 >= 0) focusMonthAt(monthIndex - 3);
      else if (monthIndex % 3 === 2) nextYearButtonRef.current?.focus();
      else prevYearButtonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (monthIndex + 3 <= 11) focusMonthAt(monthIndex + 3);
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
    <div className={cn("p-3", CALENDAR_VIEWPORT_WIDTH_CLASS)} data-calendar-month-picker="true">
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
            return (
              <button
                key={monthIndex}
                ref={(element) => {
                  monthButtonRefs.current[monthIndex] = element;
                }}
                type="button"
                name="month"
                aria-label={format(monthDate, "MMMM yyyy")}
                className={cn(
                  buttonVariants({ variant: "clear" }),
                  "h-9 px-0",
                  isSelected && "border border-primary bg-primary/10 text-primary",
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

function Calendar({ className, classNames, showOutsideDays = true, onKeyDownCapture, month, defaultMonth, today, onMonthChange, components, ...props }: CalendarProps) {
  const isControlledMonth = month !== undefined;
  const [internalMonth, setInternalMonth] = React.useState<Date>(month ?? defaultMonth ?? today ?? new Date());
  const baseMonth = isControlledMonth ? month : internalMonth;
  const displayMonth = React.useMemo(
    () => new Date((baseMonth ?? new Date()).getFullYear(), (baseMonth ?? new Date()).getMonth(), 1),
    [baseMonth],
  );
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("day");
  const [monthPickerYear, setMonthPickerYear] = React.useState<number>(displayMonth.getFullYear());
  const [monthPickerActiveMonth, setMonthPickerActiveMonth] = React.useState<number | null>(displayMonth.getMonth());
  const [pendingDayFocusDate, setPendingDayFocusDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (viewMode !== "month") return;
    setMonthPickerYear(displayMonth.getFullYear());
  }, [displayMonth, viewMode]);

  React.useEffect(() => {
    if (!pendingDayFocusDate || viewMode !== "day") return;
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>('[data-calendar-root="true"]');
      const buttons = Array.from(root?.querySelectorAll<HTMLButtonElement>('button[name="day"]') ?? []);
      const targetButton = buttons.find((button) => {
        const label = button.getAttribute("aria-label") ?? "";
        return button.textContent?.trim() === "1" && label.includes(format(pendingDayFocusDate, "MMMM")) && label.includes(String(pendingDayFocusDate.getFullYear()));
      }) ?? buttons.find((button) => button.textContent?.trim() === "1" && !button.className.includes("day-outside"));
      targetButton?.focus();
      setPendingDayFocusDate(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingDayFocusDate, viewMode]);

  const commitMonthChange = React.useCallback((nextMonth: Date) => {
    const normalized = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    if (!isControlledMonth) {
      setInternalMonth(normalized);
    }
    onMonthChange?.(normalized);
  }, [isControlledMonth, onMonthChange]);

  const rootKeyDownCapture: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === "Tab") {
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
    <div data-calendar-root="true" onKeyDownCapture={rootKeyDownCapture}>
      {viewMode === "month" ? (
        <MonthPicker
          year={monthPickerYear}
          activeMonth={monthPickerActiveMonth}
          onYearChange={(nextYear) => {
            setMonthPickerActiveMonth(null);
            setMonthPickerYear(nextYear);
          }}
          onMonthSelect={(nextMonthIndex) => {
            const nextMonth = new Date(monthPickerYear, nextMonthIndex, 1);
            commitMonthChange(nextMonth);
            setPendingDayFocusDate(nextMonth);
            setViewMode("day");
          }}
        />
      ) : (
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={displayMonth}
          defaultMonth={displayMonth}
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
