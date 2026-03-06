import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onKeyDownCapture?: React.KeyboardEventHandler;
};

function getFocusableDayRows(root: HTMLElement): HTMLButtonElement[][] {
  return Array.from(root.querySelectorAll("tbody tr"))
    .map((row) => Array.from(row.querySelectorAll<HTMLButtonElement>('button[name="day"]')))
    .filter((row) => row.length > 0);
}

function focusCalendarArrowTarget(root: HTMLElement, activeElement: HTMLElement, key: string): boolean {
  const previousMonthButton = root.querySelector<HTMLButtonElement>('button[name="previous-month"]');
  const nextMonthButton = root.querySelector<HTMLButtonElement>('button[name="next-month"]');
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
        : (colIndex >= 4 ? nextMonthButton : previousMonthButton);
    } else if (key === "ArrowDown") {
      target = rows[rowIndex + 1]?.[Math.min(colIndex, rows[rowIndex + 1].length - 1)];
    }

    if (!target) return false;
    target.focus();
    return true;
  }

  if (activeElement === previousMonthButton) {
    if (key === "ArrowRight" && nextMonthButton) {
      nextMonthButton.focus();
      return true;
    }
    if (key === "ArrowDown" && rows[0]?.[0]) {
      rows[0][0].focus();
      return true;
    }
    return false;
  }

  if (activeElement === nextMonthButton) {
    if (key === "ArrowLeft" && previousMonthButton) {
      previousMonthButton.focus();
      return true;
    }
    if (key === "ArrowDown" && rows[0]?.at(-1)) {
      rows[0].at(-1)?.focus();
      return true;
    }
    return false;
  }

  return false;
}

function Calendar({ className, classNames, showOutsideDays = true, onKeyDownCapture, ...props }: CalendarProps) {
  return (
    <div
      data-calendar-root="true"
      onKeyDownCapture={(event: React.KeyboardEvent) => {
        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
          const root = event.currentTarget as HTMLElement;
          const activeElement = event.target instanceof HTMLElement ? event.target : null;
          if (activeElement && focusCalendarArrowTarget(root, activeElement, event.key)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
        onKeyDownCapture?.(event);
      }}
    >
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "clear" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
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
        }}
        {...(props as any)}
      />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
