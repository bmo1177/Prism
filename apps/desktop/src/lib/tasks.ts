// Scheduled agent jobs ("Tasks"): an OpenCode session turn that runs on a
// schedule — once ("at" a timestamp), on an interval ("every" N seconds), or
// on a cron expression ("cron"), or on an application event ("event"). The Rust
// side stores jobs in SQLite and fires due ones through the sidecar; here the
// page lists, creates, toggles, deletes and runs them. On the desktop these are
// Tauri invokes; the gateway web client gets the same page over the scheduler
// contract routes (/v1/jobs), so checking on a daily digest from the phone
// works too (read-only gateway tokens accept list/read only).
import { isGatewayWeb, gatewayGet, gatewaySend } from "./webMode";
import { isTauri } from "./tauri";

/** One scheduled agent job, mirroring the Rust JobRecord (camelCase). */
export interface CronJob {
  id: string;
  title: string;
  /** The prompt the sidecar session starts with when the job fires. */
  prompt: string;
  /** "at" | "every" | "cron" | "event". */
  scheduleKind: string;
  /** unix-secs (at), interval seconds (every), 5-field cron expr (cron),
   *  or event name like "session_start" | "workspace_change" | "app_startup" (event). */
  scheduleValue: string;
  enabled: boolean;
  nextRunAt?: number | null;
  lastRunAt?: number | null;
  /** The failure the last attempted fire hit, when it did not succeed
   *  (a background scheduler can fail nothing visible without this). */
  lastError?: string | null;
}

export interface NewCronJob {
  title: string;
  prompt: string;
  scheduleKind: string;
  scheduleValue: string;
}

async function cronInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** All scheduled jobs, newest first ([] when desktop APIs are unavailable). */
export async function listJobs(): Promise<CronJob[]> {
  if (isGatewayWeb) {
    try {
      return (await gatewayGet<CronJob[]>("/v1/jobs")) ?? [];
    } catch {
      return [];
    }
  }
  if (!isTauri) return [];
  try {
    return await cronInvoke<CronJob[]>("list_jobs", {});
  } catch {
    return [];
  }
}

/** Create a scheduled job. Returns the stored record (with its computed first
 *  run time), or rejects with a user-facing message. */
export async function createJob(job: NewCronJob): Promise<CronJob> {
  if (isGatewayWeb) return gatewaySend<CronJob>("/v1/jobs", "POST", job) as Promise<CronJob>;
  return whenInvoke("create_job", { job });
}

export async function deleteJob(id: string): Promise<void> {
  if (isGatewayWeb) {
    await gatewaySend<void>(`/v1/jobs/${encodeURIComponent(id)}`, "DELETE");
    return;
  }
  if (!isTauri) return;
  await whenInvoke("delete_job", { id });
}

export async function setJobEnabled(id: string, enabled: boolean): Promise<CronJob> {
  if (isGatewayWeb) {
    return gatewaySend<CronJob>(`/v1/jobs/${encodeURIComponent(id)}/enabled`, "POST", {
      enabled,
    }) as Promise<CronJob>;
  }
  return whenInvoke("set_job_enabled", { id, enabled });
}

/** Fire a job now, immediately (sidecar must be running). Resolves once the
 *  session is created and the prompt submitted. */
export async function runJobNow(id: string): Promise<void> {
  if (isGatewayWeb) {
    await gatewaySend<void>(`/v1/jobs/${encodeURIComponent(id)}/run`, "POST");
    return;
  }
  if (!isTauri) return;
  await whenInvoke("run_job_now", { id });
}

/** Fire all enabled event-triggered jobs matching the given event name.
 *  (Event triggers fire from the desktop app's own state — a sleeping phone
 *  is not a working scheduler — so this stays desktop-only.) */
export async function triggerEvent(eventName: string): Promise<void> {
  if (!isTauri) return;
  await whenInvoke("trigger_event", { eventName });
}

/** Re-add the built-in starter tasks that are missing (the built-in Daily AI
 *  Research Digest and Hermes AI Coach). Returns how many were added. */
export async function restoreDefaultTasks(): Promise<number> {
  if (isGatewayWeb) {
    return (await gatewaySend<number>("/v1/jobs/restore-defaults", "POST")) ?? 0;
  }
  return whenInvoke<number>("restore_default_jobs", {});
}

async function whenInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error("scheduler is desktop-only");
  }
  return cronInvoke<T>(cmd, args);
}
