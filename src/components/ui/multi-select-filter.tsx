import { useEffect, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SquareCheckBig } from 'lucide-react';
import { focusAdjacentFormControl } from '@/platform/formInteractions';

export interface MultiSelectFilterOption<TValue extends string> {
  value: TValue;
  label: string;
  color?: string | null;
}

interface MultiSelectFilterProps<TValue extends string> {
  label: string;
  options: Array<MultiSelectFilterOption<TValue>>;
  selectedValues: TValue[];
  onSelectedValuesChange: (values: TValue[]) => void | Promise<void>;
  className?: string;
  triggerClassName?: string;
  allLabel?: string;
  noneLabel?: string;
  showBulkActions?: boolean;
  deferSelectionUntilClose?: boolean;
  selectedSummary?: string;
  triggerProps?: Record<string, unknown>;
  onRestoreTriggerFocus?: () => void;
}

export function MultiSelectFilter<TValue extends string>({
  label,
  options,
  selectedValues,
  onSelectedValuesChange,
  className,
  triggerClassName,
  allLabel,
  noneLabel,
  showBulkActions = true,
  deferSelectionUntilClose = false,
  selectedSummary,
  triggerProps,
  onRestoreTriggerFocus,
}: MultiSelectFilterProps<TValue>) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const draftValuesRef = useRef<TValue[]>(selectedValues);
  const committedForCloseRef = useRef(false);
  const cancelCloseRef = useRef(false);
  const closeFocusActionRef = useRef<'trigger' | 'grid-next' | 'grid-previous' | 'next' | 'previous' | null>(null);
  const [open, setOpen] = useState(false);
  const [draftValues, setDraftValues] = useState<TValue[]>(selectedValues);
  const committedSelectedSet = new Set(selectedValues);
  const draftSelectedSet = new Set(deferSelectionUntilClose && open ? draftValues : selectedValues);
  const selectedCount = options.filter((option) => committedSelectedSet.has(option.value)).length;
  const allSelected = selectedCount === options.length;
  const noneSelected = selectedCount === 0;
  const summary = selectedSummary ?? (allSelected
    ? (allLabel ?? `All ${label}`)
      : noneSelected
        ? (noneLabel ?? `No ${label}`)
        : selectedCount === 1
        ? options.find((option) => committedSelectedSet.has(option.value))?.label ?? label
        : `${selectedCount} ${label}`);

  useEffect(() => {
    if (!open) {
      draftValuesRef.current = selectedValues;
      setDraftValues(selectedValues);
    }
  }, [open, selectedValues]);

  const setDraftSelection = (values: TValue[]) => {
    draftValuesRef.current = values;
    setDraftValues(values);
  };

  const orderedValues = (values: Set<TValue>) => options.map((option) => option.value).filter((optionValue) => values.has(optionValue));

  const commitValues = (values: TValue[]) => {
    return onSelectedValuesChange(options.map((option) => option.value).filter((optionValue) => values.includes(optionValue)));
  };

  const commitDraftValues = () => {
    if (!deferSelectionUntilClose) return undefined;
    if (committedForCloseRef.current) return undefined;
    committedForCloseRef.current = true;
    return commitValues(draftValuesRef.current);
  };

  const findTriggerTarget = () => {
    const rowId = triggerProps?.['data-row-id'];
    const col = triggerProps?.['data-col'];
    if (typeof rowId === 'string' && (typeof col === 'string' || typeof col === 'number')) {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-row-id][data-col]'))
        .find((element) => element.dataset.rowId === rowId && element.dataset.col === String(col));
      if (target) return target;
    }
    return triggerRef.current;
  };

  const focusTrigger = () => {
    if (onRestoreTriggerFocus) {
      onRestoreTriggerFocus();
    }

    let attempts = 0;
    const targetRowId = triggerProps?.['data-row-id'];
    const targetCol = triggerProps?.['data-col'];
    const isTarget = (element: Element | null) => (
      element instanceof HTMLElement
      && typeof targetRowId === 'string'
      && (typeof targetCol === 'string' || typeof targetCol === 'number')
      && element.dataset.rowId === targetRowId
      && element.dataset.col === String(targetCol)
    );
    const focusWasMovedElsewhere = () => {
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) return false;
      if (isTarget(active)) return false;
      return active instanceof HTMLElement && active.hasAttribute('data-row') && active.hasAttribute('data-col');
    };
    const tryFocus = () => {
      attempts += 1;
      if (focusWasMovedElsewhere()) return;
      const target = findTriggerTarget();
      if (target && document.contains(target)) {
        target.focus({ preventScroll: true });
      }
      if (attempts < 80) {
        window.setTimeout(() => window.requestAnimationFrame(tryFocus), 24);
      }
    };
    window.requestAnimationFrame(tryFocus);
  };

  const shouldRestoreTriggerAfterAsyncCommit = () => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return true;
    const target = findTriggerTarget();
    if (!target) return false;
    return active === target || target.contains(active);
  };

  const restoreTriggerAfterAsyncCommit = (commitResult: void | Promise<void>) => {
    if (!commitResult || typeof commitResult.then !== 'function') return;
    void commitResult.finally(() => {
      window.requestAnimationFrame(() => {
        if (shouldRestoreTriggerAfterAsyncCommit()) {
          focusTrigger();
        }
      });
    }).catch(() => undefined);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      committedForCloseRef.current = false;
      closeFocusActionRef.current = null;
      setDraftSelection(selectedValues);
      setOpen(true);
      return;
    }
    if (cancelCloseRef.current) {
      cancelCloseRef.current = false;
      draftValuesRef.current = selectedValues;
      setDraftValues(selectedValues);
      setOpen(false);
      return;
    }
    commitDraftValues();
    setOpen(false);
  };

  const setOptionChecked = (value: TValue, checked: boolean) => {
    const next = new Set(draftSelectedSet);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    const nextValues = orderedValues(next);
    if (deferSelectionUntilClose) {
      setDraftSelection(nextValues);
    } else {
      onSelectedValuesChange(nextValues);
    }
  };

  const handleMenuKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    if (deferSelectionUntilClose && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const commitResult = commitDraftValues();
      closeFocusActionRef.current = 'trigger';
      setOpen(false);
      focusTrigger();
      restoreTriggerAfterAsyncCommit(commitResult);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const commitResult = commitDraftValues();
      const isGridTrigger = triggerProps?.['data-row'] != null && triggerProps?.['data-col'] != null;
      closeFocusActionRef.current = isGridTrigger
        ? (event.shiftKey ? 'grid-previous' : 'grid-next')
        : (event.shiftKey ? 'previous' : 'next');
      setOpen(false);
      if (commitResult) void commitResult.catch(() => undefined);
    }
  };

  const handleCloseAutoFocus = (event: Event) => {
    const closeFocusAction = closeFocusActionRef.current;
    closeFocusActionRef.current = null;
    if (closeFocusAction === 'trigger') {
      event.preventDefault();
      focusTrigger();
      return;
    }
    if (closeFocusAction === 'grid-next' || closeFocusAction === 'grid-previous') {
      event.preventDefault();
      if (triggerRef.current) {
        focusAdjacentFormControl(triggerRef.current, closeFocusAction === 'grid-previous');
      }
      return;
    }
    if (closeFocusAction === 'next' || closeFocusAction === 'previous') {
      event.preventDefault();
      if (triggerRef.current) {
        focusAdjacentFormControl(triggerRef.current, closeFocusAction === 'previous');
      }
    }
  };

  const contentGridProps = {
    'data-row': triggerProps?.['data-row'],
    'data-row-id': triggerProps?.['data-row-id'],
    'data-col': triggerProps?.['data-col'],
  };
  const triggerKeyDown = triggerProps?.onKeyDown;
  const isGridTrigger = triggerProps?.['data-row'] != null && triggerProps?.['data-col'] != null;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 justify-between gap-2 border-input bg-background px-3 text-sm font-normal text-foreground',
            triggerClassName,
          )}
          aria-label={label}
          {...triggerProps}
          onKeyDown={(event) => {
            if (typeof triggerKeyDown === 'function') {
              triggerKeyDown(event);
            }
            if (
              event.defaultPrevented
              || isGridTrigger
              || (event.key !== 'Delete' && event.key !== 'Backspace')
            ) return;
            event.preventDefault();
            void onSelectedValuesChange([]);
          }}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <SquareCheckBig aria-hidden="true" className="!h-3.5 !w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn('w-56 bg-popover', className)}
        onKeyDownCapture={handleMenuKeyDownCapture}
        onCloseAutoFocus={handleCloseAutoFocus}
        onEscapeKeyDown={() => {
          cancelCloseRef.current = true;
        }}
        {...contentGridProps}
      >
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={draftSelectedSet.has(option.value)}
            onCheckedChange={(checked) => setOptionChecked(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="truncate">{option.label}</span>
              {option.color ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {showBulkActions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              if (deferSelectionUntilClose) {
                setDraftSelection(options.map((option) => option.value));
              } else {
                onSelectedValuesChange(options.map((option) => option.value));
              }
            }}>
              Select All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (deferSelectionUntilClose) {
                setDraftSelection([]);
              } else {
                onSelectedValuesChange([]);
              }
            }}>
              Select None
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
