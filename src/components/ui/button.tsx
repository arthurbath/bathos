import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-primary bg-background text-primary hover:bg-primary/10",
        success: "bg-success text-success-foreground hover:bg-success/90",
        "outline-success": "border border-success bg-background text-success hover:bg-success/10",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "outline-destructive": "border border-destructive bg-background text-destructive hover:bg-destructive/10",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        "outline-danger": "border border-destructive bg-background text-destructive hover:bg-destructive/10",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        "outline-warning": "border border-warning bg-background text-warning hover:bg-warning/10",
        info: "bg-info text-info-foreground hover:bg-info/90",
        "outline-info": "border border-info bg-background text-info hover:bg-info/10",
        admin: "bg-admin text-admin-foreground hover:bg-admin/90",
        "outline-admin": "border border-admin bg-background text-admin hover:bg-admin/10",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        "ghost-destructive": "hover:bg-destructive/10 hover:text-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
