import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { PersistentTooltipText } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataGridAddFormLabelProps {
  children: ReactNode;
  tooltip?: ReactNode;
  htmlFor?: string;
  className?: string;
  tooltipTabStop?: boolean;
  required?: boolean;
}

/**
 * Standard label component for data-grid add forms.
 * If `tooltip` is provided, label text mirrors header tooltip behavior.
 */
export function DataGridAddFormLabel({
  children,
  tooltip,
  htmlFor,
  className,
  tooltipTabStop = true,
  required = false,
}: DataGridAddFormLabelProps) {
  const label = (
    <Label
      htmlFor={htmlFor}
      className={cn(required && 'inline-flex items-center gap-1', className)}
    >
      <span>{children}</span>
      {required && <span className="text-destructive" aria-hidden="true">*</span>}
    </Label>
  );

  if (!tooltip) return label;

  return (
    <PersistentTooltipText side="bottom" content={tooltip} includeInTabOrder={tooltipTabStop}>
      {label}
    </PersistentTooltipText>
  );
}
