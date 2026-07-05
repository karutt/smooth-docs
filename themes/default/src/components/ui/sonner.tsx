import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  const classNames = toastOptions?.classNames;

  return (
    <Sonner
      className={cn("docs-toaster toaster group", className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...classNames,
          toast: cn("docs-toast group toast", classNames?.toast),
          title: cn("docs-toast-title", classNames?.title),
          description: cn("docs-toast-description", classNames?.description),
          content: cn("docs-toast-content", classNames?.content),
          icon: cn("docs-toast-icon", classNames?.icon),
          closeButton: cn("docs-toast-close", classNames?.closeButton),
          actionButton: cn("docs-toast-action", classNames?.actionButton),
          cancelButton: cn("docs-toast-cancel", classNames?.cancelButton),
          success: cn("docs-toast-success", classNames?.success),
          info: cn("docs-toast-info", classNames?.info),
          warning: cn("docs-toast-warning", classNames?.warning),
          error: cn("docs-toast-error", classNames?.error),
          loading: cn("docs-toast-loading", classNames?.loading),
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
