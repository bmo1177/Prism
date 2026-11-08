import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileSearch,
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  Moon,
  NotebookPen,
  PackagePlus,
  Plus,
  Presentation,
  RotateCw,
  ScanSearch,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useUiStore } from "@/lib/store";
import { useRuntimeStore } from "@/lib/runtime";
import { useLayoutStore } from "@/lib/layout";
import { useIsMobile } from "@/lib/useIsMobile";
import { isGatewayWeb } from "@/lib/webMode";
import { WORKFLOW_STARTERS } from "@/components/thread/WorkflowStarters";

interface Action {
  id: string;
  group: "quick" | "cowork" | "design" | "science" | "tools";
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

/** Prompt for a starter workflow by id, so ⌘K and the empty-session cards stay in sync. */
const starterPrompt = (id: string) => WORKFLOW_STARTERS.find((s) => s.id === id)?.prompt ?? "";

export function CommandPalette() {
  const { t } = useTranslation("nav");
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
  // Tiling is desktop-only: web/phone show one pane, so there is no Screen to open.
  const newPaneAllowed = !useIsMobile() && !isGatewayWeb;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
      // Consume Esc only when the palette is open — a marked-handled Esc must
      // not also interrupt a running agent turn (LiveSessionPage listens too).
      if (e.key === "Escape" && useUiStore.getState().paletteOpen) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const close = () => setOpen(false);

  // Start a new session and send a workflow prompt, then reveal that session.
  // Its own Screen and pane, like every other "new session" entry — the pane the
  // user was reading stays put.
  const runWorkflow = async (starterId: string) => {
    close();
    const layout = useLayoutStore.getState();
    const leafId = newPaneAllowed ? layout.openInNewGroup(null) : null;
    useRuntimeStore.getState().startDraft();
    const id = await useRuntimeStore.getState().sendPrompt(starterPrompt(starterId));
    if (id && leafId) layout.bindSession(leafId, id);
    if (id) navigate(`/live/${id}`);
  };

  const actions: Action[] = [
    {
      id: "new",
      group: "quick",
      label: t("commandPalette.actions.newSession"),
      icon: <Plus size={15} />,
      shortcut: isMac ? "⌘N" : "Ctrl+N",
      run: () => {
        if (newPaneAllowed) useLayoutStore.getState().openInNewGroup(null);
        useRuntimeStore.getState().startDraft();
        navigate("/live");
        close();
      },
    },
    {
      id: "theme",
      group: "quick",
      label: t("commandPalette.actions.toggleTheme"),
      icon: <Moon size={15} />,
      run: () => {
        toggleTheme();
        close();
      },
    },
    {
      id: "settings",
      group: "quick",
      label: t("commandPalette.actions.openSettings"),
      icon: <Settings size={15} />,
      shortcut: isMac ? "⌘," : "Ctrl+,",
      run: () => {
        navigate("/settings");
        close();
      },
    },
    {
      id: "analyze",
      group: "cowork",
      label: t("commandPalette.actions.analyzeData"),
      icon: <FileSearch size={15} />,
      run: () => void runWorkflow("analyze"),
    },
    {
      id: "review",
      group: "cowork",
      label: t("commandPalette.actions.auditReport"),
      icon: <ShieldCheck size={15} />,
      run: () => void runWorkflow("audit"),
    },
    {
      id: "docx",
      group: "cowork",
      label: t("commandPalette.actions.docx"),
      icon: <FileText size={15} />,
      run: () => void runWorkflow("docx"),
    },
    {
      id: "pptx",
      group: "cowork",
      label: t("commandPalette.actions.pptx"),
      icon: <Presentation size={15} />,
      run: () => void runWorkflow("pptx"),
    },
    {
      id: "xlsx",
      group: "cowork",
      label: t("commandPalette.actions.xlsx"),
      icon: <FileSpreadsheet size={15} />,
      run: () => void runWorkflow("xlsx"),
    },
    {
      id: "pdf",
      group: "cowork",
      label: t("commandPalette.actions.pdf"),
      icon: <FileText size={15} />,
      run: () => void runWorkflow("pdf"),
    },
    {
      id: "design-wireframe",
      group: "design",
      label: t("commandPalette.actions.designWireframe"),
      icon: <LayoutTemplate size={15} />,
      run: () => void runWorkflow("design-wireframe"),
    },
    {
      id: "design-deck",
      group: "design",
      label: t("commandPalette.actions.designDeck"),
      icon: <Presentation size={15} />,
      run: () => void runWorkflow("design-deck"),
    },
    {
      id: "design-review",
      group: "design",
      label: t("commandPalette.actions.designReview"),
      icon: <ScanSearch size={15} />,
      run: () => void runWorkflow("design-review"),
    },
    {
      id: "science-survey",
      group: "science",
      label: t("commandPalette.actions.scienceSurvey"),
      icon: <BookOpen size={15} />,
      run: () => void runWorkflow("science-survey"),
    },
    {
      id: "science-paper",
      group: "science",
      label: t("commandPalette.actions.sciencePaper"),
      icon: <NotebookPen size={15} />,
      run: () => void runWorkflow("science-paper"),
    },
    {
      id: "science-repro",
      group: "science",
      label: t("commandPalette.actions.scienceRepro"),
      icon: <RotateCw size={15} />,
      run: () => void runWorkflow("science-repro"),
    },
    {
      id: "science-integrity",
      group: "science",
      label: t("commandPalette.actions.scienceIntegrity"),
      icon: <ShieldCheck size={15} />,
      run: () => void runWorkflow("science-integrity"),
    },
    {
      id: "notebooks",
      group: "tools",
      label: t("commandPalette.actions.openNotebooks"),
      icon: <NotebookPen size={15} />,
      run: () => {
        navigate("/notebooks");
        close();
      },
    },
    {
      id: "skills",
      group: "tools",
      label: t("commandPalette.actions.manageSkills"),
      icon: <PackagePlus size={15} />,
      run: () => {
        navigate("/skills");
        close();
      },
    },
  ];

  const groups: { key: Action["group"]; heading: string }[] = [
    { key: "quick", heading: t("commandPalette.groups.quick") },
    { key: "cowork", heading: t("commandPalette.groups.cowork") },
    { key: "design", heading: t("commandPalette.groups.design") },
    { key: "science", heading: t("commandPalette.groups.science") },
    { key: "tools", heading: t("commandPalette.groups.tools") },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[14vh] backdrop-blur-sm"
      onClick={close}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Command
          label={t("commandPalette.ariaLabel")}
          className="overflow-hidden rounded-card border border-border bg-surface shadow-pop ring-1 ring-border/50"
        >
          <Command.Input
            autoFocus
            placeholder={t("commandPalette.placeholder")}
            className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm text-text outline-none placeholder:text-muted"
          />
          <Command.List className="max-h-[380px] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted">
              {t("commandPalette.noResults")}
            </Command.Empty>
            {groups.map((g) => {
              const groupActions = actions.filter((a) => a.group === g.key);
              if (groupActions.length === 0) return null;
              return (
                <Command.Group
                  key={g.key}
                  heading={g.heading}
                  className="px-1 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted/80"
                >
                  {groupActions.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={a.label}
                      onSelect={a.run}
                      className="group flex cursor-pointer items-center gap-3 rounded-input px-2.5 py-2 text-sm text-text transition-colors data-[selected=true]:bg-surface-2 data-[selected=true]:text-accent"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-surface-2 text-muted group-data-[selected=true]:bg-surface group-data-[selected=true]:text-accent">
                        {a.icon}
                      </span>
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.shortcut && (
                        <kbd className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {a.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-3 py-1.5 text-[11px] text-muted">
            <span>{t("commandPalette.footer.title")}</span>
            <div className="flex items-center gap-2">
              <span>{t("commandPalette.footer.navigate")}</span>
              <span>{t("commandPalette.footer.run")}</span>
              <span>{t("commandPalette.footer.close")}</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
