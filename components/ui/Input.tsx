import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/components/ui/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("cf-input", className)} {...props} />;
  }
);

