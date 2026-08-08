// Scheduled agent jobs ("Tasks"): an OpenCode session turn that runs on a
// schedule — once ("at" a timestamp), on an interval ("every" N seconds), or
// on a cron expression ("cron"), or on an application event ("event"). The Rust
// side stores jobs in SQLite and fires due ones through the sidecar; here the
// page lists, creates, toggles, deletes and runs them. In the gateway web client
// these commands are hidden (the running desktop app owns the scheduler).
import { isGatewayWeb, gatewayGet } from "./webMode";
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
  return whenInvoke("create_job", { job });
}

export async function deleteJob(id: string): Promise<void> {
  if (!isTauri) return;
  await whenInvoke("delete_job", { id });
}

export async function setJobEnabled(id: string, enabled: boolean): Promise<CronJob> {
  return whenInvoke("set_job_enabled", { id, enabled });
}

/** Fire a job now, immediately (sidecar must be running). Resolves once the
 *  session is created and the prompt submitted. */
export async function runJobNow(id: string): Promise<void> {
  if (!isTauri) return;
  await whenInvoke("run_job_now", { id });
}

/** Fire all enabled event-triggered jobs matching the given event name. */
export async function triggerEvent(eventName: string): Promise<void> {
  if (!isTauri) return;
  await whenInvoke("trigger_event", { eventName });
}

async function whenInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error("scheduler is desktop-only");
  }
  return cronInvoke<T>(cmd, args);
}