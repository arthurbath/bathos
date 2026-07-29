import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const InputGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-10 min-w-0 w-full items-center rounded-md border border-[hsl(var(--grid-sticky-line))] bg-background outline-none transition-[color,box-shadow] has-[>textarea]:h-auto",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/65",
        "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/20",
        className,
      )}
      {...props}
    />
  ),
);
InputGroup.displayName = "InputGroup";

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-3",
        "inline-end": "order-last pr-1",
        "block-start": "order-first w-full justify-start px-3 pt-3",
        "block-end": "order-last w-full justify-start px-3 pb-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  onClick,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || (event.target as HTMLElement).closest("button")) return;
        event.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2",
        sm: "h-8 gap-1.5 px-2.5",
        "icon-xs": "size-7 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

type InputGroupButtonProps = Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>;

const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({
    className,
    type = "button",
    variant = "ghost",
    size = "xs",
    ...props
  }, ref) => (
    <Button
      ref={ref}
      type={type}
      data-slot="input-group-button"
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  ),
);
InputGroupButton.displayName = "InputGroupButton";

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

const InputGroupInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  ),
);
InputGroupInput.displayName = "InputGroupInput";

const InputGroupTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>(({ className, ...props }, ref) => (
  <Textarea
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0",
      className,
    )}
    {...props}
  />
));
InputGroupTextarea.displayName = "InputGroupTextarea";

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
