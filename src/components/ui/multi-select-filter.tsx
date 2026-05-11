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

export interface MultiSelectFilterOption<TValue extends string> {
  value: TValue;
  label: string;
  color?: string | null;
}

interface MultiSelectFilterProps<TValue extends string> {
  label: string;
  options: Array<MultiSelectFilterOption<TValue>>;
  selectedValues: TValue[];
  onSelectedValuesChange: (values: TValue[]) => void;
  className?: string;
  triggerClassName?: string;
  allLabel?: string;
  noneLabel?: string;
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
}: MultiSelectFilterProps<TValue>) {
  const selectedSet = new Set(selectedValues);
  const selectedCount = options.filter((option) => selectedSet.has(option.value)).length;
  const allSelected = selectedCount === options.length;
  const noneSelected = selectedCount === 0;
  const summary = allSelected
    ? (allLabel ?? `All ${label}`)
    : noneSelected
      ? (noneLabel ?? `No ${label}`)
      : selectedCount === 1
        ? options.find((option) => selectedSet.has(option.value))?.label ?? label
        : `${selectedCount} ${label}`;

  const setOptionChecked = (value: TValue, checked: boolean) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    onSelectedValuesChange(options.map((option) => option.value).filter((optionValue) => next.has(optionValue)));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 justify-between gap-2 border-[hsl(var(--grid-sticky-line))] bg-background px-3 text-sm font-normal text-foreground enabled:hover:bg-primary/10',
            triggerClassName,
          )}
          aria-label={label}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <SquareCheckBig aria-hidden="true" className="!h-3.5 !w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('w-56 bg-popover', className)}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedSet.has(option.value)}
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelectedValuesChange(options.map((option) => option.value))}>
          Select All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectedValuesChange([])}>
          Select None
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
