import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DataGridAddFormAffixInputProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  prefix?: string;
  suffix?: string;
}

/**
 * Standard numeric input for data-grid add forms.
 * Mirrors static prefix/suffix affordances used in grid cells (e.g. $ and %).
 */
export function DataGridAddFormAffixInput({ prefix, suffix, className, ...props }: DataGridAddFormAffixInputProps) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        {...props}
        type="number"
        className={cn(
          'text-right',
          prefix && 'pl-4',
          suffix && 'pr-6',
          className,
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}
