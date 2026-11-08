import { test, expect } from "@playwright/test";

// Science / Design / Tasks galleries are desktop-only (isTauri). In plain
// browser E2E they must show the honest "available in the desktop app"
// empty state instead of crashing — that's the web-parity contract.
test.describe("Desktop-only galleries degrade honestly in the browser", () => {
  test("science shows web-only note", async ({ page }) => {
    await page.goto("/science");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Science skills" })).toBeVisible();
    await expect(page.getByText("Science skills are available in the desktop app.")).toBeVisible();
  });

  test("design shows web-only note", async ({ page }) => {
    await page.goto("/design");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Design templates" })).toBeVisible();
    await expect(page.getByText("Design templates are available in the desktop app.")).toBeVisible();
  });

  test("settings is reachable from the shell", async ({ page }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: "artifacts/settings.png" });
  });
});
