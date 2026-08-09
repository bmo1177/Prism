import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Atom, Loader2, Sparkles } from "lucide-react";
import { listScienceSkills, scienceSkillPrompt, type ScienceSkill } from "@/lib/science";
import { isTauri } from "@/lib/tauri";
import { isGatewayWeb } from "@/lib/webMode";
import { useRuntimeStore } from "@/lib/runtime";
import { useLayoutStore } from "@/lib/layout";
import { useIsMobile } from "@/lib/useIsMobile";
import { PageHeader } from "@/components/cards/PageHeader";

function SkillCard({ skill, onUse }: { skill: ScienceSkill; onUse: (s: ScienceSkill) => void }) {
  const { t } = useTranslation("pages");
  return (
    <article className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-pop">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-input bg-surface-2 p-1.5 text-accent">
          <Atom size={16} strokeWidth={1.75} />
        </span>
        <h3 className="text-[14px] font-medium leading-snug text-text">{skill.title}</h3>
        <span className="ml-auto shrink-0 truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
          {skill.dir}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{skill.tagline}</p>
      <button
        onClick={() => onUse(skill)}
        className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg transition-opacity hover:opacity-90"
      >
        <Sparkles size={13} />
        {t("science.useSkill")}
      </button>
    </article>
  );
}

/**
 * The science skill gallery (Phase 4): the bundled science skills as
 * startable cards — "Use this skill" fires a fresh session with a prompt that
 * points the agent at the skill's bundled SKILL.md. Mirrors the design gallery
 * with one difference: each card is a workflow, not an artifact, so there is no
 * example.html to preview.
 */
export function SciencePage() {
  const { t } = useTranslation("pages");
  const navigate = useNavigate();
  const [skills, setSkills] = useState<ScienceSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Tiling is desktop-only — web/phone show one pane, so there is no new Screen.
  const newPaneAllowed = !useIsMobile() && !isGatewayWeb;

  useEffect(() => {
    let alive = true;
    listScienceSkills()
      .then((items) => {
        if (!alive) return;
        setSkills(items);
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
  // a fresh session with the skill prompt and reveal that session.
  const useSkill = (skill: ScienceSkill) => {
    void (async () => {
      const layout = useLayoutStore.getState();
      const leafId = newPaneAllowed ? layout.openInNewGroup(null) : null;
      useRuntimeStore.getState().startDraft();
      const id = await useRuntimeStore.getState().sendPrompt(scienceSkillPrompt(skill));
      if (id && leafId) layout.bindSession(leafId, id);
      if (id) navigate(`/live/${id}`);
    })();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PageHeader
          icon={<Atom size={18} strokeWidth={1.75} />}
          title={t("science.title")}
          subtitle={t("science.subtitle")}
        />

        {!isTauri ? (
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
            {t("science.webOnly")}
          </p>
        ) : loading ? (
          <div className="mt-12 grid place-items-center">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : failed ? (
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">{t("science.error")}</p>
        ) : skills.length === 0 ? (
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">
            {t("science.empty.noSkills")}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill, i) => (
              <div
                key={skill.dir}
                className="card-enter"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <SkillCard skill={skill} onUse={useSkill} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}