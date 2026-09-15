import { useTheme } from "next-themes";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      duration={5_000}
      visibleToasts={3}
      gap={10}
      richColors
      containerAriaLabel="Alpha Market notifications"
      icons={{
        success: <CheckCircle2 aria-hidden="true" size={20} strokeWidth={2.6} />,
        error: <XCircle aria-hidden="true" size={21} strokeWidth={2.6} />,
        warning: <AlertTriangle aria-hidden="true" size={21} strokeWidth={2.6} />,
        info: <Info aria-hidden="true" size={21} strokeWidth={2.6} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
