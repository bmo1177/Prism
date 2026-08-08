import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesignPage, designStylePrompt } from "./DesignPage";
import type { DesignTemplate } from "@/lib/designTemplates";
import { useRuntimeStore } from "@/lib/runtime";

const listDesignTemplates = vi.fn();
const designPreviewUrl = vi.fn();
// Force the gallery path (Tauri-only — data + local-server previews live on the Rust side).
vi.mock("@/lib/tauri", () => ({ isTauri: true }));
vi.mock("@/lib/designTemplates", () => ({
  listDesignTemplates: () => listDesignTemplates(),
  designPreviewUrl: (dir: string) => designPreviewUrl(dir),
}));

const DECK: DesignTemplate = {
  dir: "html-ppt-zhangzara-blue-professional",
  kind: "deck",
  title: "Blue Professional",
  tagline: "Cream paper with cobalt blue accents.",
  palette: ["#FDFAE7", "#1E2BFA", "#111111", "#6B6B6B"],
  bestFor: "B2B SaaS pitches.",
};
const WIREFRAME: DesignTemplate = {
  dir: "wireframe-greybox",
  kind: "wireframe",
  title: "Wireframe Greybox",
  tagline: "A crisp greybox wireframe.",
  palette: [],
  bestFor: "",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/design"]}>
      <Routes>
        <Route path="/design" element={<DesignPage />} />
        <Route path="/live/:sessionId" element={<div>live-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DesignPage", () => {
  beforeEach(() => {
    listDesignTemplates.mockReset();
    designPreviewUrl.mockReset();
    designPreviewUrl.mockResolvedValue("http://127.0.0.1:9000/x/wf");
  });

  it("renders the gallery grouped by kind with previews and palette chips", async () => {
    listDesignTemplates.mockResolvedValue([WIREFRAME, DECK]);
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Design templates" })).toBeInTheDocument();
    // Section headings + template titles appear once the listing resolves.
    await waitFor(() => expect(screen.getByText("Wireframes")).toBeInTheDocument());
    expect(screen.getByText("Slide decks")).toBeInTheDocument();
    expect(screen.getByText("Wireframe Greybox")).toBeInTheDocument();
    expect(screen.getByText("Blue Professional")).toBeInTheDocument();

    // Every card previews its bundled example artifact via the local server.
    await waitFor(() =>
      expect(screen.getAllByTitle(/preview of/i).length).toBeGreaterThan(0),
    );
    expect(designPreviewUrl).toHaveBeenCalledWith("wireframe-greybox");
    expect(designPreviewUrl).toHaveBeenCalledWith("html-ppt-zhangzara-blue-professional");
    // Decks surface their "best for" audience so the card reads as useful.
    expect(screen.getByText("Best for: B2B SaaS pitches.")).toBeInTheDocument();
  });

  it("shows the deck palette chips and settles failures without a hanging spinner", async () => {
    listDesignTemplates.mockResolvedValue([DECK, WIREFRAME]);
    designPreviewUrl.mockResolvedValueOnce("http://127.0.0.1:9000/x/deck");
    designPreviewUrl.mockRejectedValueOnce(new Error("boom"));
    renderPage();

    // Two palette swatch chips from the deck metadata.
    expect(await screen.findAllByTitle(/preview of/i)).toHaveLength(1);
    // The failed preview falls back to a quiet message instead of spinning forever.
    expect(await screen.findByText("Preview unavailable.")).toBeInTheDocument();
  });

  it('sends a style-pinned prompt when "Use this style" is clicked on a deck', async () => {
    listDesignTemplates.mockResolvedValue([DECK]);
    const sendPrompt = vi
      .spyOn(useRuntimeStore.getState(), "sendPrompt")
      .mockResolvedValue("sess-123");

    renderPage();
    await userEvent.click(await screen.findByText("Use this style"));

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    // The prompt pins the chosen deck skill, exact palette hexes and typography.
    expect(sendPrompt.mock.calls[0][0]).toContain("Blue Professional");
    expect(sendPrompt.mock.calls[0][0]).toContain("html-ppt-zhangzara-blue-professional");
    expect(sendPrompt.mock.calls[0][0]).toContain("#1E2BFA");
    expect(sendPrompt.mock.calls[0][0]).toContain("deck.html");
    // A session is revealed for the fresh prompt.
    expect(await screen.findByText("live-page")).toBeInTheDocument();

    sendPrompt.mockRestore();
  });

  it("builds wireframe/critique prompts from the shared starters", () => {
    expect(designStylePrompt(WIREFRAME)).toContain("Wireframe the app or page");
    expect(designStylePrompt({ ...DECK, kind: "critique" })).toContain("critique");
  });
});