import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FlaskConical, Loader2, NotebookPen } from "lucide-react";
import { WORKFLOW_STARTERS } from "@/components/thread/WorkflowStarters";
import { listNotebooks } from "@/lib/artifactFile";
import { queryRuns } from "@/lib/runs";
import { isTauri } from "@/lib/tauri";
import { isGatewayWeb } from "@/lib/webMode";
import { useIsMobile } from "@/lib/useIsMobile";
import { useRuntimeStore } from "@/lib/runtime";
import { useLayoutStore } from "@/lib/layout";

/** The four science on-ramps, in the order the welcome screen and palette show. */
const SCIENCE_IDS = [
  "science-survey",
  "science-paper",
  "science-repro",
  "science-integrity",
] as const;
type ScienceId = (typeof SCIENCE_IDS)[number];



function StarterCard({
  icon,
  title,
  description,
  onStart,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onStart: () => void;
}) {
  const { t } = useTranslation("pages");
  return (
    <article className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3.5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted">{icon}</span>
        <h3 className="text-[13.5px] font-medium leading-snug text-text">{title}</h3>
      </div>
      <p className="text-xs leading-snug text-muted">{description}</p>
      <button
        onClick={onStart}
        className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-input bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
      >
        {t("research.startWorkflow")}
      </button>
    </article>
  );
}

function LabTile({
  icon,
  title,
  count,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  count: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start gap-1.5 rounded-card border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
    >
      <div className="flex w-full items-center gap-2">
        <span className="shrink-0 text-muted">{icon}</span>
        <span className="text-[13px] font-medium text-text">{title}</span>
        <ArrowRight size={13} className="ml-auto shrink-0 text-muted" />
      </div>
      <span className="text-xs text-muted">{count}</span>
    </button>
  );
}

/**
 * The science pillar's home screen (Phase 4): a place to start a research
 * workflow — the same four science starters as the welcome screen and command
 * palette — plus a glance at the local lab (notebooks and recorded runs).
 * The starters are pure prompts and work everywhere; the lab tiles read the
 * local data surfaces, so in the web client they degrade to a quiet notice.
 */
export function ResearchPage() {
  const { t } = useTranslation("pages");
  const { t: ts } = useTranslation("session");
  const navigate = useNavigate();
  const [notebookCount, setNotebookCount] = useState<number | null>(null);
  const [runCount, setRunCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Tiling is desktop-only — web/phone show one pane, so there is no new Screen.
  const newPaneAllowed = !useIsMobile() && !isGatewayWeb;

  useEffect(() => {
    if (!isTauri) return;
    let alive = true;
    void Promise.all([
      listNotebooks("base").then((n) => alive && setNotebookCount(n.length)).catch(() => {}),
      queryRuns({ limit: 1 }).then((p) => alive && setRunCount(p.total)).catch(() => {}),
    ]).finally(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Display copy per starter id — the literal-keyed map the welcome screen
  // uses, so the generated `t()` key type stays literal.
  const copy: Record<ScienceId, { title: string; description: string }> = {
    "science-survey": {
      title: ts("starters.science-survey.title"),
      description: ts("starters.science-survey.description"),
    },
    "science-paper": {
      title: ts("starters.science-paper.title"),
      description: ts("starters.science-paper.description"),
    },
    "science-repro": {
      title: ts("starters.science-repro.title"),
      description: ts("starters.science-repro.description"),
    },
    "science-integrity": {
      title: ts("starters.science-integrity.title"),
      description: ts("starters.science-integrity.description"),
    },
  };
  const starters = SCIENCE_IDS.map((id) => {
    const starter = WORKFLOW_STARTERS.find((s) => s.id === id);
    return starter ? { starter, copy: copy[id] } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // A grid click behaves exactly like the palette's workflow actions: start a
  // fresh session with the workflow prompt and reveal that session.
  const startWorkflow = (prompt: string) => {
    void (async () => {
      const layout = useLayoutStore.getState();
      const leafId = newPaneAllowed ? layout.openInNewGroup(null) : null;
      useRuntimeStore.getState().startDraft();
      const id = await useRuntimeStore.getState().sendPrompt(prompt);
      if (id && leafId) layout.bindSession(leafId, id);
      if (id) navigate(`/live/${id}`);
    })();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="text-center">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted">
            {t("research.eyebrow")}
          </div>
          <h1 className="mt-2.5 font-serif text-[26px] leading-tight text-text">
            {t("research.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {t("research.subtitle")}
          </p>
        </div>

        <section className="mt-9">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {t("research.sectionWorkflows")}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {starters.map(({ starter, copy }) => (
              <StarterCard
                key={starter.id}
                icon={starter.icon}
                title={copy.title}
                description={copy.description}
                onStart={() => startWorkflow(starter.prompt)}
              />
            ))}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {t("research.sectionLab")}
          </h2>
          {!isTauri ? (
            <p className="mt-3 rounded-card border border-border bg-surface p-4 text-sm text-muted">
              {t("research.webOnly")}
            </p>
          ) : !loaded ? (
            <div className="mt-6 grid place-items-center">
              <Loader2 size={18} className="animate-spin text-muted" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabTile
                icon={<NotebookPen size={15} />}
                title={t("research.openNotebooks")}
                count={t("research.notebooksCount", { count: notebookCount ?? 0 })}
                onClick={() => navigate("/notebooks")}
              />
              <LabTile
                icon={<FlaskConical size={15} />}
                title={t("research.openRuns")}
                count={t("research.runsCount", { count: runCount ?? 0 })}
                onClick={() => navigate("/runs")}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}