import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FlaskConical, Loader2, Microscope, NotebookPen } from "lucide-react";
import { WORKFLOW_STARTERS } from "@/components/thread/WorkflowStarters";
import { listNotebooks } from "@/lib/artifactFile";
import { queryRuns } from "@/lib/runs";
import { isTauri } from "@/lib/tauri";
import { isGatewayWeb } from "@/lib/webMode";
import { useIsMobile } from "@/lib/useIsMobile";
import { useRuntimeStore } from "@/lib/runtime";
import { useLayoutStore } from "@/lib/layout";
import { PageHeader } from "@/components/cards/PageHeader";

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
    <article className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-pop">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-input bg-surface-2 p-1.5 text-accent">{icon}</span>
        <h3 className="text-[14px] font-medium leading-snug text-text">{title}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      <button
        onClick={onStart}
        className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg transition-opacity hover:opacity-90"
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
      className="group flex w-full flex-col items-start gap-1.5 rounded-card border border-border bg-surface px-5 py-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:bg-surface-2 hover:shadow-pop"
    >
      <div className="flex w-full items-center gap-2">
        <span className="shrink-0 rounded-input bg-surface-2 p-1.5 text-accent">{icon}</span>
        <span className="text-[14px] font-medium text-text">{title}</span>
        <ArrowRight size={14} className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
      </div>
      <span className="mt-1 text-xs text-muted">{count}</span>
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
        <PageHeader
          icon={<Microscope size={18} strokeWidth={1.75} />}
          title={t("research.title")}
          subtitle={t("research.subtitle")}
        />

        <section className="mt-8">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {t("research.sectionWorkflows")}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {starters.map(({ starter, copy }, i) => (
              <div
                key={starter.id}
                className="card-enter"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <StarterCard
                  icon={starter.icon}
                  title={copy.title}
                  description={copy.description}
                  onStart={() => startWorkflow(starter.prompt)}
                />
              </div>
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
              <div className="card-enter" style={{ animationDelay: "160ms" }}>
                <LabTile
                  icon={<NotebookPen size={15} />}
                  title={t("research.openNotebooks")}
                  count={t("research.notebooksCount", { count: notebookCount ?? 0 })}
                  onClick={() => navigate("/notebooks")}
                />
              </div>
              <div className="card-enter" style={{ animationDelay: "200ms" }}>
                <LabTile
                  icon={<FlaskConical size={15} />}
                  title={t("research.openRuns")}
                  count={t("research.runsCount", { count: runCount ?? 0 })}
                  onClick={() => navigate("/runs")}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}