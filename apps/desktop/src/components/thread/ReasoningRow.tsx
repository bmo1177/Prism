import { memo, useState, useEffect } from "react";
import { Brain, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReasoningBlock } from "@ai4s/shared";
import { cn } from "@/lib/cn";

/**
 * The model's reasoning ("thinking"). It auto-expands and streams live while the
 * thought is being produced, then auto-collapses to a one-line "Thought" the
 * moment the agent moves on (a later block appears, or the turn ends) — the user
 * can click it back open. `streaming` is derived by the caller (this reasoning
 * is the last block of a still-running session). `inline` renders it bare for
 * use inside a tool activity group; standalone gets its own bordered card.
 *
 * Visual distinction from the answer: uses a muted, italic styling with a subtle
 * left accent border and a brain/sparkle icon to clearly separate the reasoning
 * process from the actual response content.
 */
export const ReasoningRow = memo(function ReasoningRow({
  block,
  streaming = false,
  inline = false,
}: {
  block: ReasoningBlock;
  streaming?: boolean;
  inline?: boolean;
}) {
  const { t } = useTranslation(["session", "common"]);
  // A manual toggle sticks; otherwise the open state follows `streaming`, so a
  // thought unfolds as it streams and folds itself away once it's done.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [hasBeenCollapsed, setHasBeenCollapsed] = useState(false);

  useEffect(() => {
    if (!streaming && block.text.trim() && !hasBeenCollapsed) {
      setUserOpen(false);
      setHasBeenCollapsed(true);
    }
    if (streaming) {
      setHasBeenCollapsed(false);
    }
  }, [streaming, block.text, hasBeenCollapsed]);

  const text = block.text.trim();
  if (!text) return null;
  const open = userOpen ?? streaming;
  const previewText = text.slice(0, 120) + (text.length > 120 ? "…" : "");

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        !inline && "rounded-lg",
        open ? "max-h-96" : "max-h-12",
      )}
    >
      {/* Left accent border to distinguish from answer content */}
      {!inline && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-colors duration-300",
            streaming
              ? "bg-gradient-to-b from-violet-400 via-purple-400 to-indigo-400 animate-pulse"
              : "bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700",
          )}
        />
      )}

      <div
        className={cn(
          "transition-colors duration-300",
          !inline && "border border-border/50 bg-muted/20 dark:bg-muted/10",
          !inline && "rounded-lg",
          open && !inline && "bg-muted/30 dark:bg-muted/15",
        )}
      >
        <button
          className={cn(
            "flex w-full items-center gap-2 text-left text-xs",
            inline ? "px-2 py-1" : "pl-4 pr-3 py-2",
            "hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors rounded-lg",
          )}
          onClick={() => {
            setUserOpen(!open);
            setHasBeenCollapsed(true);
          }}
          aria-expanded={open}
        >
          {streaming ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-violet-500" />
          ) : open ? (
            <Sparkles size={14} className="shrink-0 text-amber-500/80" />
          ) : (
            <Brain size={14} className="shrink-0 text-muted-foreground/60" />
          )}
          <span
            className={cn(
              "font-medium",
              streaming ? "text-violet-600 dark:text-violet-400 animate-pulse" : "text-muted-foreground/80",
            )}
          >
            {streaming ? t("reasoning.thinking") : t("reasoning.thought")}
          </span>
          {!open && (
            <span className="flex-1 truncate text-[11px] text-muted-foreground/50 italic pl-1">
              {previewText}
            </span>
          )}
          <ChevronRight
            size={14}
            className={cn(
              "ml-auto shrink-0 transition-transform duration-200 text-muted-foreground/50",
              open && "rotate-90",
            )}
          />
        </button>
        {open && (
          <div
            className={cn(
              "max-h-56 overflow-y-auto",
              inline ? "pb-2 pl-7 pr-2" : "pl-4 pr-3 pb-3",
            )}
          >
            <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted/80 italic">
              {text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
