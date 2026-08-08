import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import {
  designPreviewUrl,
  listDesignTemplates,
  type DesignTemplate,
} from "@/lib/designTemplates";
import { isTauri } from "@/lib/tauri";
import { isGatewayWeb } from "@/lib/webMode";
import { useRuntimeStore } from "@/lib/runtime";
import { useLayoutStore } from "@/lib/layout";
import { useIsMobile } from "@/lib/useIsMobile";
import { WORKFLOW_STARTERS } from "@/components/thread/WorkflowStarters";

/** Prompt for a starter workflow by id — the same lookup the command palette uses. */
const starterPrompt = (id: string) => WORKFLOW_STARTERS.find((s) => s.id === id)?.prompt ?? "";

/** Prompt a gallery "use this style" click fires: decks pin the chosen style —
 *  concrete palette hexes included so the agent uses the exact colors;
 *  wireframe/critique reuse their starter so the class (or the artifact to fix)
 *  is chosen by the agent. */
export function designStylePrompt(t: DesignTemplate): string {
  if (t.kind === "deck") {
    const palette = t.palette.length > 0 ? ` Its palette hexes are ${t.palette.join(" ")} — use them exactly.` : "";
    return (
      `Create an HTML slide deck using the design skills in the "${t.title}" style — ` +
      `use the bundled ${t.dir} deck skill, matching its palette and typography exactly.` +
      palette +
      ` Ask me first what the deck is about and who the audience is, then build a ` +
      `self-contained deck.html in the workspace with arrow-key/space navigation, slide ` +
      `dots, and print=one-slide-per-page — every slide fully written, no placeholder lorem.`
    );
  }
  if (t.kind === "wireframe") return starterPrompt("design-wireframe");
  return starterPrompt("design-review");
}

const SECTIONS: {
  kind: DesignTemplate["kind"];
  titleKey: "design.sectionWireframes" | "design.sectionCritique" | "design.sectionDecks";
}[] = [
  { kind: "wireframe", titleKey: "design.sectionWireframes" },
  { kind: "critique", titleKey: "design.sectionCritique" },
  { kind: "deck", titleKey: "design.sectionDecks" },
];

/** A gallery card's live preview: the bundled example artifact rendered in a
 *  sandboxed iframe via the local file server (http://127.0.0.1, correct MIME).
 *  A failed preview must never hang on its spinner — it settles into a quiet
 *  fallback so the rest of the card stays usable. */
function TemplatePreview({ dir }: { dir: string }) {
  const { t } = useTranslation("pages");
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    designPreviewUrl(dir)
      .then((url) => {
        if (!alive) return;
        if (url) setSrc(url);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [dir]);
  if (failed) {
    return (
      <div className="grid aspect-[16/10] place-items-center bg-surface-2 px-4 text-center">
        <span className="text-xs text-muted">{t("design.previewUnavailable")}</span>
      </div>
    );
  }
  if (src === null) {
    return (
      <div className="grid aspect-[16/10] place-items-center bg-surface-2">
        <Loader2 size={16} className="animate-spin text-muted" />
      </div>
    );
  }
  return (
    <iframe
      title={t("design.previewAria", { title: dir })}
      src={src}
      loading="lazy"
      className="aspect-[16/10] w-full border border-border bg-white"
      sandbox="allow-scripts"
    />
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: DesignTemplate;
  onUse: (t: DesignTemplate) => void;
}) {
  const { t } = useTranslation("pages");
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <TemplatePreview dir={template.dir} />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13.5px] font-medium leading-snug text-text">{template.title}</h3>
          {template.palette.length > 0 && (
            <span className="flex shrink-0 items-center gap-1" aria-hidden>
              {template.palette.map((hex) => (
                <span
                  key={hex}
                  className="h-3 w-3 rounded-full ring-1 ring-border/60"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </span>
          )}
        </div>
        <p className="text-xs leading-snug text-muted">{template.tagline}</p>
        {template.bestFor && (
          <p className="text-xs leading-snug text-muted/80">
            {t("design.bestFor", { text: template.bestFor })}
          </p>
        )}
        <button
          onClick={() => onUse(template)}
          className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-input bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Sparkles size={13} />
          {t("design.useStyle")}
        </button>
      </div>
    </article>
  );
}

function Section({
  headingKey,
  templates,
  onUse,
}: {
  headingKey: "design.sectionWireframes" | "design.sectionCritique" | "design.sectionDecks";
  templates: DesignTemplate[];
  onUse: (t: DesignTemplate) => void;
}) {
  const { t } = useTranslation("pages");
  if (templates.length === 0) return null;
  return (
    <section className="mt-9">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        {t(headingKey)}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template.dir} template={template} onUse={onUse} />
        ))}
      </div>
    </section>
  );
}

export function DesignPage() {
  const { t } = useTranslation("pages");
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Tiling is desktop-only — web/phone show one pane, so there is no new Screen.
  const newPaneAllowed = !useIsMobile() && !isGatewayWeb;

  useEffect(() => {
    let alive = true;
    listDesignTemplates()
      .then((items) => {
        if (!alive) return;
        setTemplates(items);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // A gallery click behaves exactly like the palette's workflow actions: start
  // a fresh session with the template's prompt and reveal that session.
  const useStyle = (template: DesignTemplate) => {
    void (async () => {
      const layout = useLayoutStore.getState();
      const leafId = newPaneAllowed ? layout.openInNewGroup(null) : null;
      useRuntimeStore.getState().startDraft();
      const id = await useRuntimeStore.getState().sendPrompt(designStylePrompt(template));
      if (id && leafId) layout.bindSession(leafId, id);
      if (id) navigate(`/live/${id}`);
    })();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="text-center">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted">
          {t("design.eyebrow")}
        </div>
        <h1 className="mt-2.5 font-serif text-[26px] leading-tight text-text">
          {t("design.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {t("design.subtitle")}
        </p>
      </div>

      {!isTauri ? (
        <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
          {t("design.webOnly")}
        </p>
      ) : loading ? (
        <div className="mt-12 grid place-items-center">
          <Loader2 size={18} className="animate-spin text-muted" />
        </div>
      ) : failed ? (
        <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">{t("design.error")}</p>
      ) : templates.length === 0 ? (
        <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
          {t("design.empty.noTemplates")}
        </p>
      ) : (
        <div className="mt-4">
          {SECTIONS.map((section) => (
            <Section
              key={section.kind}
              headingKey={section.titleKey}
              templates={templates.filter((template) => template.kind === section.kind)}
              onUse={useStyle}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);
}