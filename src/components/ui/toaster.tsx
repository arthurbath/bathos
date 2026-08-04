import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { getToastDurationMs } from "@/lib/toastDuration";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, ...props }) {
        const hasTitleAndDescription = Boolean(title) && Boolean(description);
        return (
          <Toast
            key={id}
            {...props}
            duration={duration ?? getToastDurationMs(title, description)}
          >
            <div
              className={hasTitleAndDescription ? "grid gap-1" : "grid"}
              data-toast-content=""
            >
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
