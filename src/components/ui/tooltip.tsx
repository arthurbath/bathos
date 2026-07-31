import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>,
  "delayDuration" | "skipDelayDuration"
>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={0}
      skipDelayDuration={0}
      {...props}
    />
  );
}

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerMove, ...props }, ref) => (
  <TooltipPrimitive.Trigger
    ref={ref}
    onPointerMove={(event) => {
      onPointerMove?.(event);
      event.preventDefault();
    }}
    {...props}
  />
));
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border border-[hsl(var(--tooltip-border))] bg-[hsl(var(--tooltip-bg))] px-3 py-1.5 text-sm text-[hsl(var(--tooltip-foreground))] shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      style={{
        ...style,
        // Clamp tooltip width to viewport even when trigger sits in an overflow-x container.
        maxWidth: "min(calc(100vw - 1rem), var(--tooltip-content-max-width, 100vw))",
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface PersistentTooltipTextProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["align"];
  contentClassName?: string;
  triggerClassName?: string;
  includeInTabOrder?: boolean;
}

function PersistentTooltipText({
  children,
  content,
  side = "top",
  align = "center",
  contentClassName,
  triggerClassName,
  includeInTabOrder = true,
}: PersistentTooltipTextProps) {
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = React.useState(false);
  const open = pinned;

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      setPinned(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <span
          ref={triggerRef}
          tabIndex={includeInTabOrder ? 0 : -1}
          role="button"
          className={cn(
            "inline-block cursor-help underline decoration-dotted underline-offset-2 focus:outline-none [&_*]:cursor-help",
            triggerClassName,
          )}
          onFocus={() => setPinned(true)}
          onBlur={() => setPinned(false)}
          onClick={() => setPinned(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setPinned(true);
            }
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={contentClassName}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, PersistentTooltipText };
