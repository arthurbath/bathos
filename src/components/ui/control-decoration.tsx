import * as React from 'react';

import { cn } from '@/lib/utils';

type ControlDecorationProps = React.ComponentProps<'span'>;

function ControlDecoration({
  className,
  children,
  ...props
}: ControlDecorationProps) {
  return (
    <span
      aria-hidden="true"
      data-control-decoration
      className={cn(
        'pointer-events-none inline-flex shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { ControlDecoration };
