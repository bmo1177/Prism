import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared page hero: accent icon tile + serif title + subtitle + trailing
 *  actions. Every route's header reads the same way, so the page's purpose
 *  and current section are obvious at a glance across the app. */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-start gap-3", className)}>
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-surface-3/60 text-focus shadow-[0_1px_2px_var(--depth-shallow),0_0_0_1px_var(--border-faint)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-2xl leading-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
