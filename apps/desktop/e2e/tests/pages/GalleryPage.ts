import { Page, Locator } from "@playwright/test";

export class GalleryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly cardCountBadge: Locator;

  constructor(page: Page, headingName: string) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: headingName });
  }

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async filterTabs(name: string) {
    return this.page.getByRole("button", { name });
  }
}
