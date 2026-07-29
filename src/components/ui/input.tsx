import * as React from "react";

import { ControlDecoration } from "@/components/ui/control-decoration";
import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  decoration?: React.ReactNode;
  decorationClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, decoration, decorationClassName, ...props }, ref) => {
    const input = (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[hsl(var(--grid-sticky-line))] bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/65 focus:ring-offset-0 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          decoration && "pl-9",
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    if (!decoration) return input;

    return (
      <span className="relative flex min-w-0 flex-1" data-decorated-control>
        <ControlDecoration
          className={cn("absolute inset-y-0 left-3 z-10", decorationClassName)}
        >
          {decoration}
        </ControlDecoration>
        {input}
      </span>
    );
  },
);
Input.displayName = "Input";

export { Input, type InputProps };
