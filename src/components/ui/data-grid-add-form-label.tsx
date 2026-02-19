import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DataGridAddFormLabelProps {
  children: ReactNode;
  tooltip?: ReactNode;
  htmlFor?: string;
  className?: string;
}

/**
 * Standard label component for data-grid add forms.
 * If `tooltip` is provided, label text mirrors header tooltip behavior.
 */
export function DataGridAddFormLabel({ children, tooltip, htmlFor, className }: DataGridAddFormLabelProps) {
  const label = (
    <Label
      htmlFor={htmlFor}
      className={cn(
        tooltip && 'underline decoration-dotted underline-offset-2',
        className,
      )}
    >
      {children}
    </Label>
  );

  if (!tooltip) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {label}
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
