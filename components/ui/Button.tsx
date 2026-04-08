import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/components/ui/cn";

type ButtonVariant = "default" | "primary";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ variant = "default", className, ...props }, ref) {
  const base = variant === "primary" ? "cf-button-primary" : "cf-button";
  return <button ref={ref} className={cn(base, className)} {...props} />;
});

