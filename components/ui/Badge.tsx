import { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("cf-chip", className)} {...props} />;
}

