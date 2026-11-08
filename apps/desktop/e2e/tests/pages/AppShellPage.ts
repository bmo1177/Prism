import { Page, Locator } from "@playwright/test";

export class AppShellPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly commandPalette: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator("aside.sidebar-surface");
    this.commandPalette = page.getByRole("combobox", { name: "Command palette" });
    this.settingsLink = page.getByRole("button", { name: /Settings/i });
  }

  async goto(path = "/live") {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async openCommandPalette() {
    await this.page.keyboard.press("Control+K");
    await this.commandPalette.waitFor({ state: "visible" });
  }

  async closeCommandPalette() {
    await this.page.keyboard.press("Escape");
  }

  async navigateViaSidebar(name: string) {
    // "New" is a button (programmatic new session); everything else is a link.
    // Exact match disambiguates from "New project".
    if (name === "New") {
      await this.sidebar.getByRole("button", { name: "New", exact: true }).click();
      return;
    }
    await this.sidebar.getByRole("link", { name }).click();
  }
}
