import { Toaster as Sonner, toast as sonnerToast, type ExternalToast } from "sonner";

import { getToastDurationMs } from "@/lib/toastDuration";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={{
        right: "var(--bathos-toast-desktop-right-offset)",
        bottom: "var(--bathos-toast-bottom-offset)",
      }}
      mobileOffset={{
        right: "1rem",
        bottom: "var(--bathos-toast-bottom-offset)",
        left: "1rem",
      }}
      className="bathos-sonner-toaster toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !p-3 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

type SonnerErrorMessage = Parameters<typeof sonnerToast.error>[0];

function showSonnerErrorToast(message: SonnerErrorMessage, data?: ExternalToast) {
  return sonnerToast.error(message, {
    ...data,
    duration: getToastDurationMs(message, data?.description),
  });
}

export { Toaster, showSonnerErrorToast };
