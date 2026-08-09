import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Clock, Loader2, Pause, Play, Plus, Trash2, X, Zap } from "lucide-react";
import type { CronJob, NewCronJob } from "@/lib/tasks";
import { createJob, deleteJob, listJobs, runJobNow, setJobEnabled } from "@/lib/tasks";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { isGatewayWeb } from "@/lib/webMode";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/cards/PageHeader";

/** Sidebar "Tasks" page - scheduled agent runs ("AI cowork automation"). Each
 *  job fires an OpenCode session turn on a schedule; runs land in the normal
 *  conversation history. Desktop-only (the desktop app owns the scheduler). */
export function TasksPage() {
  const { t } = useTranslation(["tasks", "common"]);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticking, setTicking] = useState(false);
  const [editing, setEditing] = useState<NewCronJob>({
    title: "",
    prompt: "",
    scheduleKind: "daily",
    scheduleValue: "0 8 * * *",
  });
  // For the "at" kind we keep a datetime-local string and derive scheduleValue from it.
  const [atDatetime, setAtDatetime] = useState("");
  // For "daily" and "weekday" kinds we keep a time string (HH:MM).
  const [timeValue, setTimeValue] = useState("08:00");
  const [showForm, setShowForm] = useState(false);
  /** A task awaiting the destructive delete confirmation. */
  const [pendingDelete, setPendingDelete] = useState<CronJob | null>(null);
  // Hoisted so the datetime picker's floor doesn't recompute on every render.
  const [minDatetime] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16));

  const reload = useCallback(async () => {
    try {
      const next = await listJobs();
      setJobs(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Refresh while the page lives so a due job's next-run time stays current.
    const id = setInterval(() => void reload(), 15_000);
    return () => clearInterval(id);
  }, [reload]);

  const handleKindChange = (kind: string) => {
    let defaultValue = "0 8 * * *";
    if (kind === "every") defaultValue = "3600";
    if (kind === "cron") defaultValue = "0 9 * * 1-5";
    if (kind === "at") defaultValue = "";
    if (kind === "event") defaultValue = "session_start";
    if (kind === "daily") defaultValue = timeToCron(timeValue, "daily");
    if (kind === "weekday") defaultValue = timeToCron(timeValue, "weekday");
    setEditing((s) => ({ ...s, scheduleKind: kind, scheduleValue: defaultValue }));
    if (kind !== "at") setAtDatetime("");
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
    setEditing((s) => ({
      ...s,
      scheduleValue: timeToCron(time, s.scheduleKind),
    }));
  };

  const handleAtDatetimeChange = (value: string) => {
    setAtDatetime(value);
    if (value) {
      // Convert local datetime string to unix seconds for the backend.
      const unixSecs = Math.floor(new Date(value).getTime() / 1000);
      setEditing((s) => ({ ...s, scheduleValue: String(unixSecs) }));
    } else {
      setEditing((s) => ({ ...s, scheduleValue: "" }));
    }
  };

  const submit = async () => {
    const payload: NewCronJob = {
      title: editing.title.trim(),
      prompt: editing.prompt.trim(),
      scheduleKind: editing.scheduleKind,
      scheduleValue: editing.scheduleValue.trim(),
    };
    if (!payload.prompt) {
      toast.error(t("error.promptRequired"));
      return;
    }
    if (payload.scheduleKind === "at" && !payload.scheduleValue) {
      toast.error(t("error.atRequired", "Please pick a date and time."));
      return;
    }
    setTicking(true);
    try {
      await createJob(payload);
      toast.success(t("created"));
      setShowForm(false);
      setAtDatetime("");
      setTimeValue("08:00");
      setEditing({ title: "", prompt: "", scheduleKind: "daily", scheduleValue: "0 8 * * *" });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTicking(false);
    }
  };

  const remove = async (job: CronJob) => {
    await deleteJob(job.id);
    setPendingDelete(null);
    await reload();
  };

  const toggleEnabled = async (job: CronJob) => {
    try {
      await setJobEnabled(job.id, !job.enabled);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const fire = async (job: CronJob) => {
    setTicking(true);
    try {
      await runJobNow(job.id);
      toast.success(t("fired"));
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTicking(false);
    }
  };

  if (isGatewayWeb) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-8">
          <h1 className="font-serif text-xl text-text">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{t("webOnly")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <PageHeader
          icon={<CalendarClock size={18} strokeWidth={1.75} />}
          title={t("title")}
          subtitle={t("description")}
          actions={
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? t("form.cancel") : t("form.add")}
            </button>
          }
        />

        {showForm && (
          <div className="mt-3 space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{t("form.title")}</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))}
                placeholder={t("form.titlePlaceholder")}
                className="w-full rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{t("form.prompt")}</span>
              <textarea
                value={editing.prompt}
                onChange={(e) => setEditing((s) => ({ ...s, prompt: e.target.value }))}
                placeholder={t("form.promptPlaceholder")}
                rows={3}
                className="w-full resize-none rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block min-w-[7rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-muted">{t("form.schedule")}</span>
                <select
                  value={editing.scheduleKind}
                  onChange={(e) => handleKindChange(e.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {["daily", "weekday", "every", "cron", "at", "event"].map((k) => (
                    <option key={k} value={k} className="bg-surface">
                      {/* @ts-expect-error dynamic i18n key */}
                      {t(`scheduleKind.${k}`)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Exact datetime picker for "at" kind */}
              {editing.scheduleKind === "at" ? (
                <label className="block min-w-[12rem] flex-1">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("form.atDatetime", "Run at")}</span>
                  <input
                    type="datetime-local"
                    value={atDatetime}
                    min={minDatetime}
                    onChange={(e) => handleAtDatetimeChange(e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
                  />
                </label>
              ) : editing.scheduleKind === "event" ? (
                /* Event name selector */
                <label className="block min-w-[10rem] flex-1">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("form.event", "Trigger event")}</span>
                  <select
                    value={editing.scheduleValue}
                    onChange={(e) => setEditing((s) => ({ ...s, scheduleValue: e.target.value }))}
                    className="w-full rounded-input border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    {["session_start", "workspace_change", "app_startup"].map((ev) => (
                      <option key={ev} value={ev} className="bg-surface">
                        {eventLabel(ev)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : editing.scheduleKind === "daily" || editing.scheduleKind === "weekday" ? (
                /* Time picker for daily/weekday kinds */
                <label className="block min-w-[8rem] flex-1">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("form.time", "Time")}</span>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="shrink-0 text-muted" />
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="w-full rounded-input border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                </label>
              ) : (
                /* Free-text value field for "every" and "cron" */
                <label className="block min-w-[10rem] flex-1">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("form.value")}</span>
                  <input
                    value={editing.scheduleValue}
                    onChange={(e) => setEditing((s) => ({ ...s, scheduleValue: e.target.value }))}
                    placeholder={placeholderFor(editing.scheduleKind, t)}
                    className="w-full rounded-input border border-border bg-surface px-2.5 py-1.5 font-mono text-sm text-text outline-none placeholder:text-muted focus:border-accent"
                  />
                </label>
              )}

              <button
                onClick={() => void submit()}
                disabled={ticking}
                className="flex items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {ticking && <Loader2 size={14} className="animate-spin" />}
                {t("form.create")}
              </button>
            </div>

            {/* Quick presets for "daily" and "weekday" kinds */}
            {(editing.scheduleKind === "daily" || editing.scheduleKind === "weekday") && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted">{t("form.presets", "Quick:")}</span>
                {/* eslint-disable i18next/no-literal-string -- time presets, displayed verbatim */}
                {[
                  { label: "7:00", time: "07:00" },
                  { label: "8:00", time: "08:00" },
                  { label: "9:00", time: "09:00" },
                  { label: "12:00", time: "12:00" },
                  { label: "18:00", time: "18:00" },
                ].map(({ label, time }) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleTimeChange(time)}
                    className={cn(
                      "rounded-input border border-border bg-surface px-2.5 py-1 text-xs text-text transition-colors hover:bg-surface-2",
                      timeValue === time && "border-accent",
                    )}
                  >
                    {label}
                  </button>
                ))}
                {/* eslint-enable i18next/no-literal-string */}
              </div>
            )}

            {/* Quick presets for "every" kind */}
            {editing.scheduleKind === "every" && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-muted">{t("form.presets", "Quick:")}</span>
                {/* eslint-disable i18next/no-literal-string -- time-unit shorthand (15m/1h/6h/24h), displayed verbatim per existing convention */}
                {[
                  { label: "15m", secs: "900" },
                  { label: "1h", secs: "3600" },
                  { label: "6h", secs: "21600" },
                  { label: "24h", secs: "86400" },
                ].map(({ label, secs }) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setEditing((s) => ({ ...s, scheduleValue: secs }))}
                    className={cn(
                      "rounded-input border border-border bg-surface px-2.5 py-1 text-xs text-text transition-colors hover:bg-surface-2",
                      editing.scheduleValue === secs && "border-accent",
                    )}
                  >
                    {label}
                  </button>
                ))}
                {/* eslint-enable i18next/no-literal-string */}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-accent" /> {t("loading")}
          </div>
        )}

        {!loading && jobs.length === 0 && !showForm && (
          <div className="mt-6 flex flex-col items-center rounded-card border border-dashed border-border bg-surface p-8 text-center shadow-card">
            <div className="rounded-input bg-surface-2 p-2.5 text-accent">
              <CalendarClock size={24} strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-sm font-medium text-text">{t("empty.title")}</p>
            <p className="mt-1 max-w-sm text-xs text-muted">{t("empty.body")}</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-input bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              <Plus size={14} />
              {t("form.add")}
            </button>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {jobs.map((job, i) => (
              <li
                key={job.id}
                className="card-enter rounded-card border border-border bg-surface p-4 shadow-card transition-all hover:border-accent/30 hover:shadow-pop"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", job.enabled ? "bg-ok" : "bg-muted/40")} />
                      <span className="truncate text-sm font-medium text-text">{job.title || t("untitledTask", "Untitled Task")}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted">{job.prompt}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10.5px]">
                        {formatScheduleLabel(job)}
                      </span>
                      {job.nextRunAt != null && job.scheduleKind !== "event" && (
                        <span title={absoluteTs(job.nextRunAt)}>
                          {job.enabled ? t("nextRun") : t("paused")} · {relativeTs(job.nextRunAt)}
                        </span>
                      )}
                      {job.scheduleKind === "event" && (
                        <span className="italic">{t("eventTrigger", "Fires on event")}</span>
                      )}
                      {job.lastRunAt != null && (
                        <span title={absoluteTs(job.lastRunAt)}>
                          {t("lastRun")} · {relativeTs(job.lastRunAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label={job.enabled ? t("pause") : t("resume")} onClick={() => void toggleEnabled(job)} disabled={ticking}>
                      {job.enabled ? <Pause size={13} /> : <Play size={13} />}
                    </IconButton>
                    <IconButton label={t("runNow")} onClick={() => void fire(job)} disabled={ticking}>
                      <Zap size={13} />
                    </IconButton>
                    <IconButton label={t("delete")} onClick={() => setPendingDelete(job)} disabled={ticking}>
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={t("confirmDelete.title", "Delete Task")}
          body={t("confirmDelete.description", "Are you sure you want to delete this task? This action cannot be undone.")}
          confirmLabel={t("confirmDelete.confirm", "Delete")}
          onConfirm={() => void remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-input p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function placeholderFor(kind: string, _t: any): string {
  switch (kind) {
    case "every":
      return "3600  (seconds)";
    case "cron":
      return "0 9 * * 1-5";
    default:
      return "";
  }
}

/** Convert an HH:MM time string to a cron expression.
 *  daily → "M H * * *"   (every day)
 *  weekday → "M H * * 1-5" (Mon-Fri) */
function timeToCron(time: string, kind: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = Math.min(23, Math.max(0, h || 0));
  const minute = Math.min(59, Math.max(0, m || 0));
  if (kind === "weekday") return `${minute} ${hour} * * 1-5`;
  return `${minute} ${hour} * * *`;
}

/** Human-readable label for the schedule badge in the job list. */
function formatScheduleLabel(job: CronJob): string {
  switch (job.scheduleKind) {
    case "event":
      return `event: ${job.scheduleValue}`;
    case "at":
      return `at: ${absoluteTs(Number(job.scheduleValue))}`;
    case "daily": {
      const cronParts = job.scheduleValue.split(" ");
      return `daily at ${cronParts[1]?.padStart(2, "0")}:${cronParts[0]?.padStart(2, "0")}`;
    }
    case "weekday": {
      const cronParts = job.scheduleValue.split(" ");
      return `weekdays at ${cronParts[1]?.padStart(2, "0")}:${cronParts[0]?.padStart(2, "0")}`;
    }
    case "every":
      return `every: ${job.scheduleValue}s`;
    case "cron":
      return `cron: ${job.scheduleValue}`;
    default:
      return `${job.scheduleKind}: ${job.scheduleValue}`;
  }
}

function eventLabel(ev: string): string {
  if (ev === "session_start") return "Session start";
  if (ev === "workspace_change") return "Workspace change";
  if (ev === "app_startup") return "App startup";
  return ev;
}

/** Returns a human-readable relative time from a unix timestamp.
 *  Shows "In Xm" for future, "Xm ago" for past. */
function relativeTs(ts: number): string {
  const diffSecs = Math.floor(Date.now() / 1000 - ts);
  const isFuture = diffSecs < 0;
  const secs = Math.abs(diffSecs);
  let label: string;
  if (secs < 60) label = `${secs}s`;
  else if (secs < 3600) label = `${Math.floor(secs / 60)}m`;
  else if (secs < 86_400) label = `${Math.floor(secs / 3600)}h`;
  else label = `${Math.floor(secs / 86_400)}d`;
  return isFuture ? `In ${label}` : `${label} ago`;
}

function absoluteTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}