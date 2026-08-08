import { useTranslation } from "react-i18next";
import { BookOpen, ChevronRight, FileSearch, FileSpreadsheet, FileText, FlaskConical, Globe2, LayoutTemplate, LineChart, NotebookPen, Presentation, RotateCw, ScanSearch, ShieldCheck } from "lucide-react";
import { installExample, isTauri } from "@/lib/tauri";
import { toast } from "@/lib/toast";

export interface WorkflowStarter {
  id: string;
  icon: React.ReactNode;
  /** Sent to the agent as-is — content, not UI copy, so it is never translated.
   *  The card's display title/description live in `session:starters.<id>.*`. */
  prompt: string;
  /** Side effect to run before sending the prompt (e.g. install example files). */
  prepare?: () => Promise<void>;
}

/** One-click full-workflow prompts (P0-1): a single request that carries the
 *  agent through data → code → figure → report, all inside the app. */
export const WORKFLOW_STARTERS: WorkflowStarter[] = [
  {
    id: "demo",
    icon: <FlaskConical size={17} strokeWidth={1.75} />,
    prompt:
      "Run a complete demo analysis end to end: simulate a small dose–response dataset in Python, " +
      "analyze it (fit + summary statistics), save one publication-quality figure as demo_analysis/figure1.png, " +
      "and write demo_analysis/report.md summarizing the findings — every number in the report must come from " +
      "the code you ran. Keep all files in the workspace.",
  },
  {
    id: "analyze",
    icon: <LineChart size={17} strokeWidth={1.75} />,
    prompt:
      "Analyze the data file I added to the workspace end to end: explore it, run the analysis in code, " +
      "save at least one figure as a PNG, and write report.md with the findings — every number traced to " +
      "the code that produced it. Ask me which file to use if there is more than one candidate.",
  },
  {
    id: "audit",
    icon: <FileSearch size={17} strokeWidth={1.75} />,
    prompt:
      "Use the traceability-review skill to audit the report or manuscript in my workspace: resolve every " +
      "citation, flag numbers with no traceable source, and check figures against the code that generated them. " +
      "Ask me which document to audit if there is more than one candidate.",
  },
  {
    id: "example-climate",
    icon: <Globe2 size={17} strokeWidth={1.75} />,
    prompt:
      "Analyze the real climate dataset at climate-trends/data/gistemp_global_means.csv " +
      "(NASA GISTEMP v4 global land–ocean temperature anomalies in °C vs the 1951–1980 mean; " +
      "the header is on line 2 and missing values are `***` — see climate-trends/README.md). " +
      "Load the annual J-D series, quantify the warming rate (°C/decade) over the full record and " +
      "over 1975–present, compare decadal means, save one publication-quality figure as " +
      "climate-trends/warming_trend.png, and write climate-trends/report.md citing the dataset " +
      "source — every number must come from the code you ran.",
    prepare: async () => {
      if (isTauri) await installExample("climate-trends");
    },
  },
  {
    id: "docx",
    icon: <FileText size={17} strokeWidth={1.75} />,
    prompt:
      "Create a polished Word document (.docx) using the docx skill — a professional report " +
      "with a proper title, headings, and clean formatting (no tracked changes, complete text). " +
      "Ask me what the document is about and who the audience is if I have not said — then save " +
      "the finished file in the workspace and tell me its path.",
  },
  {
    id: "pptx",
    icon: <Presentation size={17} strokeWidth={1.75} />,
    prompt:
      "Create a slide deck (.pptx) using the pptx skill: a clean, well-structured presentation " +
      "with a cover slide, an agenda, and legible text on every slide (keep it readable, not crowded, " +
      "no images pulled from the web). Ask me what the deck is about, how many slides, and who the " +
      "audience is if I have not already — then save the finished file in the workspace and tell me " +
      "its path.",
  },
  {
    id: "xlsx",
    icon: <FileSpreadsheet size={17} strokeWidth={1.75} />,
    prompt:
      "Create a professional spreadsheet (.xlsx) using the xlsx skill: organized sheets, real " +
      "formulas behind every computed column, a consistent font, and zero formula errors before " +
      "delivery (verify each sheet opens clean). Ask me what the workbook should track if I have not " +
      "already — then save the finished file in the workspace and tell me its path.",
  },
  {
    id: "pdf",
    icon: <FileSearch size={17} strokeWidth={1.75} />,
    prompt:
      "Produce a PDF deliverable using the pdf skill: combine, format, or export the source " +
      "material in my workspace into a single clean, well-ordered PDF (titles, page numbers, and " +
      "no junk pages such as blank sheets or hand backgrounds). Ask me which sources to include if it " +
      "is not obvious — then save the finished file in the workspace and tell me its path.",
  },
  {
    id: "design-wireframe",
    icon: <LayoutTemplate size={17} strokeWidth={1.75} />,
    prompt:
      "Wireframe the app or page I describe using the design skills: draw a lo-fi wireframe as a " +
      "single self-contained HTML page saved in the workspace (wireframe-mobile-flow for app flows, " +
      "wireframe-greybox for a dashboard, wireframe-annotated for a landing page with a redline spec, " +
      "wireframe-sketch for a hand-drawn exploration) — pick the variant that fits the brief, keep it " +
      "low-fidelity and structural, and tell me the path.",
  },
  {
    id: "design-deck",
    icon: <Presentation size={17} strokeWidth={1.75} />,
    prompt:
      "Create an HTML slide deck using the design skills. Ask me first: what the deck is about, who the " +
      "audience is, and which visual style to use — pick a style from the bundled deck skills, e.g. " +
      "blue-professional for business/exec reviews, monochrome for grants/theses/academic, " +
      "editorial-tri-tone for magazine-style, 8-bit-orbit for gaming/hackathons, retro-windows for " +
      "nostalgia, sakura-chroma for travel/lifestyle, pin-and-paper for field notes, or vellum for " +
      "lectures. Then build a self-contained deck.html in the workspace with the deck's design system " +
      "(palette and typography above all), arrow-key/space navigation, slide dots, and print=one-slide-" +
      "per-page — every slide fully written, no placeholder lorem.",
  },
  {
    id: "design-review",
    icon: <ScanSearch size={17} strokeWidth={1.75} />,
    prompt:
      "Run the critique skill on the HTML design artifact in my workspace: score it across the 5 " +
      "dimensions (philosophy consistency, visual hierarchy, detail execution, functionality, " +
      "innovation) with evidence for every score, and write a self-contained critique.html into the " +
      "workspace with a radar chart plus Keep / Fix / Quick-wins lists. Ask me which HTML file to " +
      "review if there is more than one candidate.",
  },
  {
    id: "science-survey",
    icon: <BookOpen size={17} strokeWidth={1.75} />,
    prompt:
      "Use the science literature skills to survey the literature on the topic I describe: screen and " +
      "rank candidate papers (literature-review), verify every citation against its full text " +
      "(citation-reviewer), and summarize each included paper's methods and key numbers. Write " +
      "literature-survey.md into the workspace with a final ranking reading list — cite only papers " +
      "you actually read, and report how many you screened vs included. Ask me for the topic and scope " +
      "if I have not given them.",
  },
  {
    id: "science-paper",
    icon: <NotebookPen size={17} strokeWidth={1.75} />,
    prompt:
      "Use the science paper-writing skills to draft a paper-style report from my workspace materials: " +
      "paper-to-report to structure it, publication-figures for every figure at publication quality, and " +
      "traceability-review on the final draft (every number traced to code or an auditable source, every " +
      "citation resolved). Ask me which files to include if it is not obvious — then write the report " +
      "into the workspace and tell me its path.",
  },
  {
    id: "science-repro",
    icon: <RotateCw size={17} strokeWidth={1.75} />,
    prompt:
      "Use the reproducible-research skill to reproduce the analysis in my workspace from its raw data " +
      "and code: rerun every step in order with a fixed seed, log the environment (large-file pointers " +
      "for big inputs), verify each figure against the code that generated it (figure-provenance), and " +
      "write reproduction-report.md noting exactly what reproduced, what differed, and what could not be " +
      "rerun. Ask me which analysis to reproduce if there is more than one candidate.",
  },
  {
    id: "science-integrity",
    icon: <ShieldCheck size={17} strokeWidth={1.75} />,
    prompt:
      "Use the science integrity skills on my analysis in the workspace: run domain-check before " +
      "executing and again on the results, apply stats-integrity to any statistical claims, and flag " +
      "each risk with evidence — never claim the analysis is sound. Write integrity-report.md with the " +
      "findings. Ask me which files to audit if there is more than one candidate.",
  },
];

/**
 * Empty-session welcome: a quiet, centered composition in the app's paper
 * aesthetic. The conversation is the point, so the copy invites a message
 * first; the starters below are an optional on-ramp, not a dashboard.
 */
export function WorkflowStarters({ onPick }: { onPick: (prompt: string) => void }) {
  const { t } = useTranslation(["session", "common"]);
  // Display copy per starter id — t()'s generated key type rejects a dynamic
  // `starters.${id}.title` template, so each card's copy is looked up by id
  // from this literal-keyed map instead.
  const starterCopy: Record<string, { title: string; description: string }> = {
    demo: { title: t("starters.demo.title"), description: t("starters.demo.description") },
    analyze: { title: t("starters.analyze.title"), description: t("starters.analyze.description") },
    audit: { title: t("starters.audit.title"), description: t("starters.audit.description") },
    "example-climate": {
      title: t("starters.example-climate.title"),
      description: t("starters.example-climate.description"),
    },
    docx: { title: t("starters.docx.title"), description: t("starters.docx.description") },
    pptx: { title: t("starters.pptx.title"), description: t("starters.pptx.description") },
    xlsx: { title: t("starters.xlsx.title"), description: t("starters.xlsx.description") },
    pdf: { title: t("starters.pdf.title"), description: t("starters.pdf.description") },
    "design-wireframe": {
      title: t("starters.design-wireframe.title"),
      description: t("starters.design-wireframe.description"),
    },
    "design-deck": {
      title: t("starters.design-deck.title"),
      description: t("starters.design-deck.description"),
    },
    "design-review": {
      title: t("starters.design-review.title"),
      description: t("starters.design-review.description"),
    },
    "science-survey": {
      title: t("starters.science-survey.title"),
      description: t("starters.science-survey.description"),
    },
    "science-paper": {
      title: t("starters.science-paper.title"),
      description: t("starters.science-paper.description"),
    },
    "science-repro": {
      title: t("starters.science-repro.title"),
      description: t("starters.science-repro.description"),
    },
    "science-integrity": {
      title: t("starters.science-integrity.title"),
      description: t("starters.science-integrity.description"),
    },
  };
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center">
      <div className="w-full max-w-[500px]">
        <div className="text-center">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-muted">
            {t("starters.newSession")}
          </div>
          <h2 className="mt-2.5 font-serif text-[26px] leading-tight text-text">
            {t("starters.heading")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("starters.subheading")}</p>
        </div>

        <div className="mt-7 overflow-hidden rounded-card border border-border bg-surface shadow-card">
          {WORKFLOW_STARTERS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                void (async () => {
                  try {
                    await s.prepare?.();
                  } catch (e) {
                    toast.error(
                      t("starters.error.setup", {
                        message: e instanceof Error ? e.message : String(e),
                      }),
                    );
                    return;
                  }
                  onPick(s.prompt);
                })();
              }}
              className="group flex w-full items-center gap-3.5 border-t border-border px-4 py-3.5 text-left transition-colors first:border-t-0 hover:bg-surface-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent ring-1 ring-border transition-colors group-hover:bg-surface">
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-text">
                  {starterCopy[s.id]?.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {starterCopy[s.id]?.description}
                </span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
