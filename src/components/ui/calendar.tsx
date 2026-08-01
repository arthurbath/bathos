import * as React from "react";
import { addDays, format, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  Button as DayPickerButton,
  DayPicker,
  type DayProps,
  useDayRender,
} from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type SingleDayPickerProps = Extract<
  React.ComponentProps<typeof DayPicker>,
  { mode: "single" }
>;

export type CalendarProps = SingleDayPickerProps & {
  allowTabExit?: boolean;
  initialFocusDate?: Date;
  initialFocusRequestKey?: number;
  onDayGridExitDown?: () => boolean;
  onKeyDownCapture?: React.KeyboardEventHandler;
};

type CalendarViewMode = "day" | "month";
const CALENDAR_VIEWPORT_WIDTH_CLASS = "box-border w-[276px]";
const CALENDAR_DAY_VIEWPORT_CLASS = `${CALENDAR_VIEWPORT_WIDTH_CLASS} min-h-[238px]`;
const CALENDAR_CAPTION_CLASS = "flex justify-center pt-1 relative items-center";
const CALENDAR_NAV_CLASS = "space-x-1 flex items-center";
const CALENDAR_NAV_BUTTON_CLASS = "h-7 w-7 bg-transparent p-0 opacity-50 enabled:!cursor-pointer  disabled:!cursor-not-allowed";
const CALENDAR_NAV_PREV_CLASS = "absolute left-1 disabled:invisible";
const CALENDAR_NAV_NEXT_CLASS = "absolute right-1";
const CALENDAR_HEADER_CLASS = "inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-medium focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0";
const CALENDAR_HEADER_BUTTON_CLASS = `${CALENDAR_HEADER_CLASS} !cursor-pointer border border-transparent bg-transparent text-white transition-colors  `;

function CalendarDay({ date, displayMonth }: DayProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dayRender = useDayRender(date, displayMonth, buttonRef);
  const isCurrentDate = Boolean(
    dayRender.activeModifiers.today && isSameMonth(date, displayMonth),
  );
  const currentDateLabel = isCurrentDate
    ? format(date, "EEEE, MMMM d, yyyy")
    : undefined;
  const dayContent = isCurrentDate ? (
    <Star
      aria-hidden="true"
      className={cn(
        "h-3.5 w-3.5",
        dayRender.activeModifiers.disabled ? "text-muted-foreground" : "text-warning",
      )}
      data-calendar-current-date-icon="true"
    />
  ) : dayRender.buttonProps.children;

  if (dayRender.isHidden) {
    return <div role="gridcell" />;
  }
  if (!dayRender.isButton) {
    return (
      <div
        {...dayRender.divProps}
        aria-current={dayRender.activeModifiers.today ? "date" : undefined}
        aria-label={currentDateLabel}
        data-calendar-date={format(date, "yyyy-MM-dd")}
      >
        {dayContent}
      </div>
    );
  }
  return (
    <DayPickerButton
      name="day"
      ref={buttonRef}
      {...dayRender.buttonProps}
      aria-current={dayRender.activeModifiers.today ? "date" : undefined}
      aria-label={currentDateLabel}
      data-calendar-date={format(date, "yyyy-MM-dd")}
    >
      {dayContent}
    </DayPickerButton>
  );
}

function getFocusableDayRows(root: HTMLElement): HTMLButtonElement[][] {
  return Array.from(root.querySelectorAll("tbody tr"))
    .map((row) => Array.from(row.querySelectorAll<HTMLButtonElement>('button[name="day"]')))
    .filter((row) => row.length > 0);
}

function canReceiveCalendarFocus(button: HTMLButtonElement | null | undefined): button is HTMLButtonElement {
  return Boolean(button && !button.disabled && button.style.visibility !== "hidden");
}

function getCalendarHeaderTarget(
  colIndex: number,
  previousMonthButton: HTMLButtonElement | null,
  captionButton: HTMLButtonElement | null,
  nextMonthButton: HTMLButtonElement | null,
): HTMLButtonElement | null {
  const preferred = colIndex >= 2 && colIndex <= 4
    ? captionButton
    : (colIndex >= 5 ? nextMonthButton : previousMonthButton);
  if (canReceiveCalendarFocus(preferred)) return preferred;
  return [captionButton, nextMonthButton, previousMonthButton]
    .find(canReceiveCalendarFocus) ?? null;
}

function findEnabledDayInColumn(
  rows: HTMLButtonElement[][],
  startRowIndex: number,
  colIndex: number,
  step: -1 | 1,
): HTMLButtonElement | null {
  for (
    let candidateRowIndex = startRowIndex;
    candidateRowIndex >= 0 && candidateRowIndex < rows.length;
    candidateRowIndex += step
  ) {
    const candidateRow = rows[candidateRowIndex];
    const candidate = candidateRow?.[Math.min(colIndex, candidateRow.length - 1)];
    if (canReceiveCalendarFocus(candidate)) return candidate;
  }
  return null;
}

function findFirstEnabledDay(rows: HTMLButtonElement[][]): HTMLButtonElement | null {
  return rows.flat().find(canReceiveCalendarFocus) ?? null;
}

function focusEnabledDayBelowHeader(
  rows: HTMLButtonElement[][],
  preferredColumn: number,
): boolean {
  const target = findEnabledDayInColumn(rows, 0, preferredColumn, 1)
    ?? findFirstEnabledDay(rows);
  if (!target) return false;
  target.focus();
  return true;
}

function focusCalendarArrowTarget(
  root: HTMLElement,
  activeElement: HTMLElement,
  key: string,
  onDayGridExitDown?: () => boolean,
  onGridEndpointPage?: (date: Date, position: "previous" | "next") => void,
  onHeaderPage?: (position: "previous" | "next") => void,
): boolean {
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
      if (rowIndex === 0 && colIndex === 0) {
        const currentDate = parseCalendarDateValue(activeElement.dataset.calendarDate);
        if (!currentDate || !canReceiveCalendarFocus(previousMonthButton)) return false;
        onGridEndpointPage?.(addDays(currentDate, -1), "previous");
        return true;
      }
      target = colIndex > 0 ? rows[rowIndex][colIndex - 1] : rows[rowIndex - 1]?.at(-1);
    } else if (key === "ArrowRight") {
      if (rowIndex === rows.length - 1 && colIndex === rows[rowIndex].length - 1) {
        const currentDate = parseCalendarDateValue(activeElement.dataset.calendarDate);
        if (!currentDate || !canReceiveCalendarFocus(nextMonthButton)) return false;
        onGridEndpointPage?.(addDays(currentDate, 1), "next");
        return true;
      }
      target = colIndex < rows[rowIndex].length - 1 ? rows[rowIndex][colIndex + 1] : rows[rowIndex + 1]?.[0];
    } else if (key === "ArrowUp") {
      target = findEnabledDayInColumn(rows, rowIndex - 1, colIndex, -1)
        ?? getCalendarHeaderTarget(
          colIndex,
          previousMonthButton,
          captionButton,
          nextMonthButton,
        );
    } else if (key === "ArrowDown") {
      target = findEnabledDayInColumn(rows, rowIndex + 1, colIndex, 1);
      if (!target) {
        onDayGridExitDown?.();
        return true;
      }
    }

    if (!canReceiveCalendarFocus(target)) return false;
    target.focus();
    return true;
  }

  if (activeElement === previousMonthButton) {
    if (key === "ArrowLeft" && canReceiveCalendarFocus(previousMonthButton)) {
      onHeaderPage?.("previous");
      return true;
    }
    if (key === "ArrowRight" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowUp" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowDown") return focusEnabledDayBelowHeader(rows, 0);
    return false;
  }

  if (activeElement === nextMonthButton) {
    if (key === "ArrowRight" && canReceiveCalendarFocus(nextMonthButton)) {
      onHeaderPage?.("next");
      return true;
    }
    if (key === "ArrowLeft" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowUp" && captionButton) {
      captionButton.focus();
      return true;
    }
    if (key === "ArrowDown") {
      return focusEnabledDayBelowHeader(
        rows,
        Math.max(0, (rows[0]?.length ?? 1) - 1),
      );
    }
    return false;
  }

  if (activeElement === captionButton) {
    if (key === "ArrowDown") return focusEnabledDayBelowHeader(rows, 3);
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
  selectedDate,
  initialFocusMonth,
  minimumDate,
  currentDate,
  onYearChange,
  onMonthSelect,
}: {
  year: number;
  selectedDate?: Date;
  initialFocusMonth: Date;
  minimumDate?: Date;
  currentDate: Date;
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
        const preferredMonth = year === initialFocusMonth.getFullYear()
          && isMonthSelectable(year, initialFocusMonth.getMonth(), minimumDate)
          ? initialFocusMonth.getMonth()
          : firstSelectableMonthIndex(year, minimumDate);
        if (preferredMonth !== null) {
          monthButtonRefs.current[preferredMonth]?.focus();
        }
      }
      pendingYearButtonFocusRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialFocusMonth, minimumDate, year]);

  const focusMonthAt = (index: number): boolean => {
    const candidate = monthButtonRefs.current[index];
    if (candidate?.disabled) return false;
    candidate?.focus();
    return Boolean(candidate);
  };

  const focusSelectableMonthBelowHeader = (preferredColumn: number) => {
    for (let monthIndex = preferredColumn; monthIndex < 12; monthIndex += 3) {
      if (focusMonthAt(monthIndex)) return;
    }
    const firstSelectable = firstSelectableMonthIndex(year, minimumDate);
    if (firstSelectable !== null) focusMonthAt(firstSelectable);
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
      else if (monthIndex % 3 === 2 || prevYearButtonRef.current?.disabled) {
        nextYearButtonRef.current?.focus();
      } else {
        prevYearButtonRef.current?.focus();
      }
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
    if (event.key === "ArrowLeft" && position === "previous") {
      event.preventDefault();
      pageYear("previous");
      return;
    }
    if (event.key === "ArrowRight" && position === "next") {
      event.preventDefault();
      pageYear("next");
      return;
    }
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
      focusSelectableMonthBelowHeader(position === "previous" ? 0 : 2);
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
              aria-label="Go to Previous Year"
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
              aria-label="Go to Next Year"
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
            const isSelected = selectedDate?.getFullYear() === year
              && selectedDate.getMonth() === monthIndex;
            const isCurrentMonth = isSameMonth(monthDate, currentDate);
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
                  "h-9 gap-1.5 px-0 enabled:!cursor-pointer disabled:!cursor-not-allowed",
                  isSelected && "!bg-accent text-accent-foreground",
                  isDisabled && "!text-muted-foreground",
                )}
                onClick={() => onMonthSelect(monthIndex)}
                onKeyDown={(event) => handleMonthGridKeyDown(event, monthIndex)}
              >
                {format(monthDate, "MMM")}
                {isCurrentMonth ? (
                  <Star
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5",
                      isDisabled ? "text-muted-foreground" : "text-warning",
                    )}
                    data-calendar-current-month-icon="true"
                  />
                ) : null}
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
  initialFocusRequestKey,
  onDayGridExitDown,
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
  const resolvedToday = today ?? new Date();
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
  const [pendingDayFocusDate, setPendingDayFocusDate] = React.useState<Date | null>(null);
  const pendingMonthNavFocusRef = React.useRef<"previous" | "next" | null>(null);
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
  }, [initialFocusRequestKey, initialFocusTime, viewMode]);

  React.useEffect(() => {
    if (!pendingMonthNavFocusRef.current || viewMode !== "day") return;
    const timer = window.setTimeout(() => {
      const previousMonthButton = rootRef.current?.querySelector<HTMLButtonElement>(
        'button[name="previous-month"]',
      );
      const nextMonthButton = rootRef.current?.querySelector<HTMLButtonElement>(
        'button[name="next-month"]',
      );
      const captionButton = rootRef.current?.querySelector<HTMLButtonElement>(
        'button[name="caption-month-year"]',
      );
      const pendingPosition = pendingMonthNavFocusRef.current;
      const requestedButton = pendingPosition === "previous"
        ? previousMonthButton
        : nextMonthButton;
      if (!canReceiveCalendarFocus(requestedButton)) {
        captionButton?.focus();
      } else {
        requestedButton.focus();
      }
      pendingMonthNavFocusRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [displayMonth, viewMode]);

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
    if (
      viewMode === "day"
      && (event.key === "Enter" || event.key === " ")
      && event.target instanceof HTMLButtonElement
      && (event.target.getAttribute("name") === "previous-month"
        || event.target.getAttribute("name") === "next-month")
    ) {
      pendingMonthNavFocusRef.current = event.target.getAttribute("name") === "previous-month"
        ? "previous"
        : "next";
    }
    if (
      viewMode === "day"
      && (event.key === "Enter" || event.key === " ")
      && event.target instanceof HTMLButtonElement
      && event.target.getAttribute("name") === "day"
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.target.click();
      return;
    }
    if (viewMode === "day" && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const root = event.currentTarget as HTMLElement;
      const activeElement = event.target instanceof HTMLElement ? event.target : null;
      if (
        activeElement
        && focusCalendarArrowTarget(
          root,
          activeElement,
          event.key,
          onDayGridExitDown,
          (endpointDate) => {
            commitMonthChange(endpointDate);
            setPendingDayFocusDate(endpointDate);
          },
          (position) => {
            const button = root.querySelector<HTMLButtonElement>(
              `button[name="${position === "previous" ? "previous-month" : "next-month"}"]`,
            );
            if (!canReceiveCalendarFocus(button)) return;
            pendingMonthNavFocusRef.current = position;
            button.click();
          },
        )
      ) {
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
          selectedDate={props.selected}
          initialFocusMonth={displayMonth}
          minimumDate={fromDate}
          currentDate={resolvedToday}
          onYearChange={(nextYear) => {
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
          {...props}
          showOutsideDays={showOutsideDays}
          fixedWeeks
          weekStartsOn={1}
          month={displayMonth}
          defaultMonth={displayMonth}
          fromDate={fromDate}
          today={resolvedToday}
          className={cn("p-2", CALENDAR_DAY_VIEWPORT_CLASS, className)}
          onMonthChange={commitMonthChange}
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-2",
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
            head_cell: "flex h-8 w-9 items-center justify-center rounded-md text-[0.8rem] font-normal text-muted-foreground",
            row: "flex w-full mt-0",
            cell: "h-8 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "clear" }),
              "h-8 w-9 p-0 font-normal enabled:!cursor-pointer disabled:!cursor-not-allowed aria-selected:opacity-100",
            ),
            day_range_end: "day-range-end",
            day_selected:
              "rounded-md !bg-accent text-accent-foreground focus:!bg-accent focus:text-accent-foreground",
            day_today: "text-accent-foreground",
            day_outside: "day-outside !text-muted-foreground",
            day_disabled: "!text-muted-foreground italic",
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
                aria-label={`Choose Month and Year, Currently ${format(captionMonth, "MMMM yyyy")}`}
                className={CALENDAR_HEADER_BUTTON_CLASS}
                onClick={() => {
                  setMonthPickerYear(displayMonth.getFullYear());
                  setViewMode("month");
                }}
              >
                {format(captionMonth, "MMMM yyyy")}
              </button>
            ),
            ...components,
          }}
          required={props.mode === "single" ? props.required ?? true : props.required}
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

function parseCalendarDateValue(value?: string): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}
