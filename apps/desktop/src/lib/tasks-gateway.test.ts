// The gateway web client (phone) gets the SAME Tasks page, backed by the
// scheduler contract routes (/v1/jobs) instead of Tauri invokes — mocked here.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isGatewayWeb: true,
  gatewayGet: vi.fn(),
  gatewaySend: vi.fn(),
  isTauri: false,
}));

vi.mock("@/lib/webMode", () => ({
  isGatewayWeb: mocks.isGatewayWeb,
  gatewayGet: mocks.gatewayGet,
  gatewaySend: mocks.gatewaySend,
}));
vi.mock("@/lib/tauri", () => ({ isTauri: mocks.isTauri }));

import {
  createJob,
  deleteJob,
  listJobs,
  restoreDefaultTasks,
  runJobNow,
  setJobEnabled,
} from "@/lib/tasks";

const JOB = { id: "abc", title: "Digest", scheduleKind: "cron", scheduleValue: "0 7 * * *", enabled: true };

describe("tasks over the gateway contract (web client)", () => {
  beforeEach(() => {
    mocks.gatewayGet.mockReset();
    mocks.gatewaySend.mockReset();
  });

  it("lists jobs through the gateway", async () => {
    mocks.gatewayGet.mockResolvedValue([JOB]);
    await expect(listJobs()).resolves.toEqual([JOB]);
    expect(mocks.gatewayGet).toHaveBeenCalledWith("/v1/jobs");
    expect(mocks.gatewaySend).not.toHaveBeenCalled();
  });

  it("creates a job by POSTing its fields", async () => {
    mocks.gatewaySend.mockResolvedValue(JOB);
    const job = { title: "Digest", prompt: "p", scheduleKind: "daily", scheduleValue: "0 7 * * *" };
    await expect(createJob(job)).resolves.toEqual(JOB);
    expect(mocks.gatewaySend).toHaveBeenCalledWith("/v1/jobs", "POST", job);
  });

  it("toggles, runs, deletes and restores over the same routes", async () => {
    mocks.gatewaySend.mockResolvedValue(JOB);
    await setJobEnabled("abc", false);
    expect(mocks.gatewaySend.mock.calls[0]).toEqual(["/v1/jobs/abc/enabled", "POST", { enabled: false }]);

    mocks.gatewaySend.mockResolvedValue(undefined);
    await runJobNow("abc");
    expect(mocks.gatewaySend.mock.calls[1]?.slice(0, 2)).toEqual(["/v1/jobs/abc/run", "POST"]);

    await deleteJob("abc");
    expect(mocks.gatewaySend.mock.calls[2]?.slice(0, 2)).toEqual(["/v1/jobs/abc", "DELETE"]);

    mocks.gatewaySend.mockResolvedValue(2);
    await expect(restoreDefaultTasks()).resolves.toBe(2);
    expect(mocks.gatewaySend.mock.calls[3]?.slice(0, 2)).toEqual(["/v1/jobs/restore-defaults", "POST"]);
  });
});
