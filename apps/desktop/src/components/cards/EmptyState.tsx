import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centered empty/teaching state: an icon, a clear title, a hint that says
 *  what to do next, and an optional action. Used by routes that have nothing
 *  to show yet - the state teaches the interface instead of just saying
 *  "nothing here". */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 p-10 text-center",
        className,
      )}
    >
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <div className="text-base font-medium text-text">{title}</div>
      {hint && <div className="max-w-sm text-sm leading-relaxed text-muted">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
