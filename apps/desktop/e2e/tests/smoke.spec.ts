import { test, expect } from "@playwright/test";
import { AppShellPage } from "./pages/AppShellPage";

test.describe("Prism web-mode smoke", () => {
  let shell: AppShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new AppShellPage(page);
    await shell.goto("/live");
  });

  test("app shell loads: sidebar + live surface", async ({ page }) => {
    await expect(shell.sidebar).toBeVisible();
    await expect(page.getByText("Prism", { exact: true }).first()).toBeVisible();
    // Offline runtime in the browser: honest connect prompt, not a blank shell.
    await expect(page.getByText("OpenCode · offline")).toBeVisible();
    await page.screenshot({ path: "artifacts/live-shell.png" });
  });

  test("sidebar navigation reaches Skills and Tasks", async ({ page }) => {
    await shell.navigateViaSidebar("Skills");
    await expect(page).toHaveURL(/\/skills/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await shell.goto("/live");
    await shell.navigateViaSidebar("Tasks");
    await expect(page).toHaveURL(/\/tasks/);
    // Tasks empty state (browser has no scheduler data).
    await expect(page.getByText("No tasks yet", { exact: false })).toBeVisible();
  });

  test("command palette opens, groups, filters, closes", async ({ page }) => {
    await shell.openCommandPalette();
    await expect(page.getByText("Quick Actions", { exact: true })).toBeVisible();
    await expect(page.getByText("Prism Quick Actions")).toBeVisible();
    await expect(page.getByText("AI Cowork & Office")).toBeVisible();

    const input = page.getByPlaceholder("Type a command…");
    await input.fill("audit");
    await expect(page.getByText("Audit a report (traceability review)")).toBeVisible();
    await expect(page.getByText("Open notebooks")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(shell.commandPalette).toBeHidden({ timeout: 5_000 });
  });

  test("offline runtime shows honest connect prompt (starters need a connected runtime)", async ({ page }) => {
    // WorkflowStarters (pillar tabs) render inside the connected empty-session
    // welcome — unit-tested in WorkflowStarters.test.tsx. In the offline browser
    // the live surface must show the connect prompt, never a dead starter.
    await shell.navigateViaSidebar("New");
    await expect(page).toHaveURL(/\/live/);
    await expect(page.getByText("OpenCode runtime")).toBeVisible();
    await expect(page.getByPlaceholder("Connect to chat")).toBeVisible();
    await page.screenshot({ path: "artifacts/offline-connect.png" });
  });

  test("unknown route shows 404", async ({ page }) => {
    await shell.goto("/does-not-exist");
    await expect(page.getByText("404 — Not found")).toBeVisible();
    await expect(page.getByText("This page does not exist.")).toBeVisible();
  });
});
