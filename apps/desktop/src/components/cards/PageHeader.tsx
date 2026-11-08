import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared page hero: accent icon tile + serif title + subtitle + trailing
 *  actions. Every route's header reads the same way, so the page's purpose
 *  and current section are obvious at a glance across the app. */
export function PageHeader({
  icon,
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-start gap-3.5", className)}>
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-surface-2 text-accent ring-1 ring-border shadow-[0_1px_2px_var(--depth-shallow)] transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-2xl leading-tight text-text">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
