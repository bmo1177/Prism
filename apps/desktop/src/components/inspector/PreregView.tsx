import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Code2,
  Dices,
  Eye,
  FileCheck,
  Filter,
  Scale,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { parsePrereg, type PreregPlan } from "@/lib/prereg";
import { CodeViewer } from "@/components/code-viewer/CodeViewer";
import { cn } from "@/lib/cn";

export function PreregView({ filename, text }: { filename: string; text: string }) {
  const { t } = useTranslation(["inspector", "common"]);
  const [viewMode, setViewMode] = useState<"overview" | "code">("overview");

  const parsed = useMemo<{ plan: PreregPlan | null; error: string | null }>(() => {
    try {
      return { plan: parsePrereg(text), error: null };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [text]);

  if (parsed.error || !parsed.plan) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="truncate font-mono text-xs text-muted">{filename}</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex max-w-md items-start gap-3 rounded-card border border-border bg-surface-2 p-4 text-left text-sm text-muted">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
            <div>
              <div className="font-medium text-primary">{t("prereg.readError", { error: parsed.error })}</div>
              <div className="mt-1 text-xs text-muted">{t("prereg.unknownFormat")}</div>
            </div>
          </div>
        </div>
        <div className="h-64 border-t border-border">
          <CodeViewer code={text} language="json" />
        </div>
      </div>
    );
  }

  const plan = parsed.plan;

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCheck className="h-4 w-4 shrink-0 text-focus" />
          <span className="truncate font-medium text-xs text-primary">
            {plan.title ?? filename}
          </span>
          <span className="rounded-full bg-focus/15 px-2 py-0.5 font-mono text-[10px] text-focus font-medium">
            {plan.schema}
          </span>
        </div>

        <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("overview")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              viewMode === "overview"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-primary",
            )}
            title={t("prereg.viewOverview")}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{t("prereg.viewOverview")}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("code")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              viewMode === "code"
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-primary",
            )}
            title={t("prereg.viewSource")}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>{t("prereg.viewSource")}</span>
          </button>
        </div>
      </div>

      {viewMode === "code" ? (
        <div className="flex-1 overflow-auto">
          <CodeViewer code={text} language="json" />
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-auto p-4 text-xs">
          {/* Header metadata */}
          <div className="rounded-card border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-primary">
                  {plan.title || filename}
                </h3>
                {plan.created && (
                  <p className="mt-0.5 text-muted">
                    {plan.created}
                  </p>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-ok">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("prereg.badge")}
              </span>
            </div>
          </div>

          {/* Hypotheses */}
          {plan.hypotheses && plan.hypotheses.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 font-medium text-xs text-primary">
                <ClipboardList className="h-3.5 w-3.5 text-focus" />
                {t("prereg.hypothesesTitle")}
              </h4>
              <div className="space-y-1.5">
                {plan.hypotheses.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-2.5 rounded-card border border-border/70 bg-surface-1 p-2.5"
                  >
                    <span className="shrink-0 rounded bg-focus/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-focus">
                      {h.id}
                    </span>
                    <p className="text-primary leading-relaxed">{h.statement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variables: Outcomes and Predictors */}
          {((plan.outcomes && plan.outcomes.length > 0) ||
            (plan.predictors && plan.predictors.length > 0)) && (
            <div className="space-y-2">
              <h4 className="font-medium text-xs text-primary">
                {t("prereg.variablesTitle")}
              </h4>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {plan.outcomes && plan.outcomes.length > 0 && (
                  <div className="rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <span className="block text-[11px] font-medium text-muted">
                      {t("prereg.outcomesLabel")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {plan.outcomes.map((o) => (
                        <span
                          key={o}
                          className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-primary"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {plan.predictors && plan.predictors.length > 0 && (
                  <div className="rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <span className="block text-[11px] font-medium text-muted">
                      {t("prereg.predictorsLabel")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {plan.predictors.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-primary"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Registered Statistical Tests */}
          {plan.tests && plan.tests.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 font-medium text-xs text-primary">
                <Scale className="h-3.5 w-3.5 text-focus" />
                {t("prereg.testsTitle")}
              </h4>
              <div className="overflow-hidden rounded-card border border-border/70">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-2 text-[11px] text-muted">
                      <th className="py-2 px-3 font-medium">{t("prereg.testColId")}</th>
                      <th className="py-2 px-3 font-medium">{t("prereg.testColFunction")}</th>
                      <th className="py-2 px-3 font-medium">{t("prereg.testColVariables")}</th>
                      <th className="py-2 px-3 font-medium">{t("prereg.testColHypothesis")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {plan.tests.map((test, idx) => (
                      <tr key={test.id || idx} className="hover:bg-surface-2/40">
                        <td className="py-2 px-3 font-mono font-medium text-focus">
                          {test.id || `T${idx + 1}`}
                        </td>
                        <td className="py-2 px-3 font-mono text-primary font-medium">
                          {test.function}
                        </td>
                        <td className="py-2 px-3 text-muted">
                          {test.variables && test.variables.length > 0 ? (
                            <span className="font-mono">{test.variables.join(", ")}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {test.hypothesis ? (
                            <span className="rounded bg-focus/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-focus">
                              {test.hypothesis}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Controls & Guardrails: Correction, Seeds, Exclusions, N */}
          {(plan.correction || plan.seeds || plan.exclusions || plan.n_min) && (
            <div className="space-y-2">
              <h4 className="font-medium text-xs text-primary">
                {t("prereg.controlsTitle")}
              </h4>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {plan.correction && (
                  <div className="flex items-start gap-2 rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-focus" />
                    <div>
                      <span className="block text-[11px] text-muted">
                        {t("prereg.correctionLabel")}
                      </span>
                      <span className="mt-0.5 inline-block font-mono font-semibold text-primary">
                        {plan.correction.method}
                      </span>
                    </div>
                  </div>
                )}
                {plan.seeds && plan.seeds.length > 0 && (
                  <div className="flex items-start gap-2 rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <Dices className="mt-0.5 h-4 w-4 shrink-0 text-focus" />
                    <div>
                      <span className="block text-[11px] text-muted">
                        {t("prereg.seedsLabel")}
                      </span>
                      <span className="mt-0.5 inline-block font-mono font-semibold text-primary">
                        {plan.seeds.join(", ")}
                      </span>
                    </div>
                  </div>
                )}
                {plan.n_min !== undefined && (
                  <div className="flex items-start gap-2 rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-focus" />
                    <div>
                      <span className="block text-[11px] text-muted">
                        {t("prereg.sampleSizeLabel")}
                      </span>
                      {/* eslint-disable-next-line i18next/no-literal-string -- mathematical notation N ≥ count */}
                      <span className="mt-0.5 inline-block font-mono font-semibold text-primary">
                        N ≥ {plan.n_min}
                      </span>
                    </div>
                  </div>
                )}
                {plan.exclusions && plan.exclusions.length > 0 && (
                  <div className="flex items-start gap-2 rounded-card border border-border/70 bg-surface-1 p-2.5">
                    <Filter className="mt-0.5 h-4 w-4 shrink-0 text-focus" />
                    <div>
                      <span className="block text-[11px] text-muted">
                        {t("prereg.exclusionsLabel")}
                      </span>
                      <div className="mt-1 space-y-0.5 font-mono text-[11px] text-muted">
                        {plan.exclusions.map((rule, idx) => (
                          <div key={idx}>{rule}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
