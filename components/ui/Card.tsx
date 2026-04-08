import { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type CardVariant = "default" | "xl" | "panel" | "row";

export function Card({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  const base =
    variant === "xl"
      ? "cf-card-xl"
      : variant === "panel"
        ? "cf-panel"
        : variant === "row"
          ? "cf-row"
          : "cf-card";

  return <div className={cn(base, className)} {...props} />;
}

