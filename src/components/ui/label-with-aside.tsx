import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface LabelWithAsideProps extends React.ComponentProps<typeof Label> {
  aside: ReactNode;
}

export function LabelWithAside({ aside, children, className, ...props }: LabelWithAsideProps) {
  return (
    <Label className={cn('inline-flex items-baseline gap-1.5', className)} {...props}>
      <span>{children}</span>
      <span className="font-normal text-muted-foreground">{aside}</span>
    </Label>
  );
}
