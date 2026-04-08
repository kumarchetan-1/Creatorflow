import { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export function SectionHeader({
  title,
  description,
  right,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)} {...props}>
      <div>
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        {description ? <div className="mt-0.5 text-sm cf-muted">{description}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

