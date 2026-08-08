import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Loader2, MessageSquare, RotateCcw, Search, ScrollText } from "lucide-react";
import type { ProvenanceRecord, RunRecord } from "@ai4s/shared";
import { queryProvenance } from "@/lib/provenance";
import { listRuns, reproduceRunPrompt } from "@/lib/runs";
import { isTauri } from "@/lib/tauri";
import { useUiStore } from "@/lib/store";
import { CodeViewer } from "@/components/code-viewer/CodeViewer";
import { DiffView } from "@/components/code-viewer/DiffView";
import { reproducePrompt } from "@/components/inspector/ProvenancePanel";
import { cn } from "@/lib/cn";
import i18n from "@/i18n";

/** Rows per page; "Load more" pages until the store's end. */
const PAGE_SIZE = 50;

function formatTs(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString(i18n.language, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The global provenance trail (Phase 4): every recorded version of every file
 * the agent wrote, across all sessions, newest first — browsable, filterable,
 * and with one-click Reproduce (drafted into the originating conversation, like
 * the per-file History panel). Data comes from `.openscience/provenance.jsonl`
 * via the `query_provenance` command.
 */
export function ProvenancePage() {
  const { t } = useTranslation("pages");
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProvenanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Runs versions can be produced by, keyed by runId — links a file to its recipe.
  const [runsById, setRunsById] = useState<Map<string, RunRecord>>(new Map());
  const setComposerDraft = useUiStore((s) => s.setComposerDraft);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const load = useCallback(
    async (cursor?: number) => {
      setLoading(cursor === undefined);
      try {
        const page = await queryProvenance({ search: debouncedSearch, beforeIndex: cursor, limit: PAGE_SIZE });
        setRows((cur) => (cursor === undefined ? page.rows : [...cur, ...page.rows]));
        setTotal(page.total);
        setNext(page.next);
        // Load the runs any of these versions were produced by, for the recipe.
        if (page.rows.some((r) => r.runId)) {
          void listRuns().then((runs) => setRunsById(new Map(runs.map((run) => [run.runId, run]))));
        }
      } catch {
        // A broken store must not crash the page — it settles on an empty state.
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch],
  );

  // Debounce the search box; every keystroke re-queries from the top.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => {
    if (!isTauri) return;
    void load();
  }, [load]);

  // A Reproduce click drafts the recipe into the conversation the version came
  // from — the user reviews and sends it (human in the loop, never auto-run).
  const reproduce = (r: ProvenanceRecord) => {
    const run = r.runId ? runsById.get(r.runId) : undefined;
    setComposerDraft(run ? reproduceRunPrompt(run) : reproducePrompt(r));
    navigate(r.sessionId ? `/live/${r.sessionId}` : "/live");
  };

  const toggle = (key: string) => {
    const cur = expandedRef.current;
    const nextSet = new Set(cur);
    if (cur.has(key)) nextSet.delete(key);
    else nextSet.add(key);
    setExpanded(nextSet);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="text-center">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted">
          {t("provenance.eyebrow")}
        </div>
        <h1 className="mt-2.5 font-serif text-[26px] leading-tight text-text">
          {t("provenance.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {t("provenance.subtitle")}
        </p>
      </div>

      {!isTauri ? (
        <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
          {t("provenance.webOnly")}
        </p>
      ) : (
        <>
          <div className="relative mx-auto mt-8 max-w-md">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("provenance.searchPlaceholder")}
              aria-label={t("provenance.searchPlaceholder")}
              className="w-full rounded-input border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <div className="mt-4 text-center text-xs text-muted">
            {t("provenance.resultCount", { count: total })}
          </div>

          {!loading && rows.length === 0 && (
            <p className="mx-auto mt-8 max-w-md text-center text-sm text-muted">
              {debouncedSearch ? t("provenance.noMatches") : t("provenance.empty")}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {rows.map((r) => {
              const key = `${r.path}#v${r.version}`;
              const open = expanded.has(key);
              return (
                <li key={key} className="rounded-input border border-border bg-surface">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    onClick={() => toggle(key)}
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown size={14} className="shrink-0 text-muted" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0 text-muted" />
                    )}
                    <span className="shrink-0 text-muted">
                      <ScrollText size={14} />
                    </span>
                    <span className="max-w-[45%] truncate font-mono text-[12.5px] text-text">{r.path}</span>
                    {/* eslint-disable-next-line i18next/no-literal-string -- "v" version-number prefix, not prose */}
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 text-xs font-medium text-muted">
                      v{r.version}
                    </span>
                    <span className="hidden shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline">
                      {r.tool}
                    </span>
                    <span className="flex-1" />
                    <span className="shrink-0 text-xs text-muted">{formatTs(r.ts)}</span>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {r.log && <span className="truncate">{r.log}</span>}
                        {r.model && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{r.model}</span>
                        )}
                        {r.runId && (
                          <span
                            className="rounded bg-surface-2 px-1.5 py-0.5 font-mono"
                            title={t("provenance.producedByRunTitle")}
                          >
                            {runsById.get(r.runId)?.command ?? r.runId}
                          </span>
                        )}
                        <span className="flex-1" />
                        {(r.content || (r.runId && runsById.has(r.runId))) && (
                          <button
                            className="flex items-center gap-1 text-link hover:underline"
                            onClick={() => reproduce(r)}
                            title={t("provenance.reproduceTitle")}
                          >
                            <RotateCcw size={12} /> {t("provenance.reproduce")}
                          </button>
                        )}
                        {r.sessionId && (
                          <button
                            className="flex items-center gap-1 text-link hover:underline"
                            onClick={() => navigate(`/live/${r.sessionId}`)}
                            title={t("provenance.openConversationTitle")}
                          >
                            <MessageSquare size={12} /> {t("provenance.openConversation")}
                          </button>
                        )}
                      </div>
                      {r.content ? (
                        <CodeViewer code={r.content} />
                      ) : r.diff ? (
                        <DiffView diff={r.diff} className="max-h-80 overflow-y-auto" />
                      ) : (
                        <p className={cn("text-xs text-muted")}>{t("provenance.contentNotCaptured")}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {next !== undefined && !loading && (
            <div className="mt-6 text-center">
              <button
                className="rounded-input border border-border bg-surface px-4 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2"
                onClick={() => void load(next)}
              >
                {t("provenance.loadMore")}
              </button>
            </div>
          )}
          {loading && rows.length === 0 && (
            <div className="mt-10 grid place-items-center">
              <Loader2 size={18} className="animate-spin text-muted" />
            </div>
          )}
        </>
      )}
    </div>
  );
}