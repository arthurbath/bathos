import * as React from "react";
import { Copy } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CopyInputGroupProps extends Omit<React.ComponentProps<typeof Input>, "value"> {
  value: string;
  copyValue?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonClassName?: string;
  buttonAriaLabel?: string;
}

async function copyTextToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall back below for browsers that expose Clipboard API but block it.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was not accepted.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

const CopyInputGroup = React.forwardRef<HTMLInputElement, CopyInputGroupProps>(
  (
    {
      value,
      copyValue,
      buttonVariant = "outline",
      buttonClassName,
      buttonAriaLabel = "Copy",
      className,
      ...props
    },
    ref,
  ) => {
    const handleCopy = async () => {
      try {
        await copyTextToClipboard(copyValue ?? value);
        toast({ title: "Copied to Clipboard" });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: error instanceof Error ? error.message : "Unable to write to clipboard.",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="flex w-full">
        <Input
          ref={ref}
          value={value}
          className={cn("min-w-0 rounded-r-none border-r-0 focus:z-10", className)}
          {...props}
        />
        <Button
          type="button"
          variant={buttonVariant}
          size="icon"
          className={cn("h-10 w-10 shrink-0 rounded-l-none", buttonClassName)}
          aria-label={buttonAriaLabel}
          onClick={() => void handleCopy()}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  },
);
CopyInputGroup.displayName = "CopyInputGroup";

export { CopyInputGroup };
