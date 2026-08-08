import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchPage } from "./ResearchPage";
import type { NotebookEntry } from "@/lib/artifactFile";
import { useRuntimeStore } from "@/lib/runtime";

// Force the lab path (notebook/run counts come from the local data surfaces).
vi.mock("@/lib/tauri", () => ({ isTauri: true }));
const listNotebooks = vi.fn();
vi.mock("@/lib/artifactFile", () => ({
  listNotebooks: () => listNotebooks(),
}));
const queryRuns = vi.fn();
vi.mock("@/lib/runs", () => ({
  queryRuns: (q: { limit?: number }) => queryRuns(q),
}));

const NOTEBOOKS: NotebookEntry[] = [
  { path: "proj/dose-response.ipynb", modified: 1720000000 },
  { path: "proj/fit-summary.ipynb", modified: 1719990000 },
];

const RUN_PAGE = {
  rows: [],
  total: 7,
  facets: { status: [], surface: [] },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/research"]}>
      <Routes>
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/live/:sessionId" element={<div>live-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResearchPage", () => {
  beforeEach(() => {
    listNotebooks.mockReset();
    queryRuns.mockReset();
    listNotebooks.mockResolvedValue(NOTEBOOKS);
    queryRuns.mockResolvedValue(RUN_PAGE);
  });

  it("renders the four science workflows and the lab tiles with their counts", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Research" })).toBeInTheDocument();
    // Every science workflow surfaces as a startable card.
    expect(screen.getByText("Survey the literature")).toBeInTheDocument();
    expect(screen.getByText("Draft a paper-style report")).toBeInTheDocument();
    expect(screen.getByText("Reproduce an analysis")).toBeInTheDocument();
    expect(screen.getByText("Audit an analysis's integrity")).toBeInTheDocument();
    expect(screen.getAllByText("Start workflow")).toHaveLength(4);

    // The lab glance reads both data surfaces and reflects their counts.
    expect(await screen.findByText("2 notebooks across your sessions")).toBeInTheDocument();
    expect(screen.getByText("7 runs recorded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notebooks/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Runs/ })).toBeInTheDocument();
  });

  it("sends the workflow prompt and reveals the live session when a card is started", async () => {
    const sendPrompt = vi
      .spyOn(useRuntimeStore.getState(), "sendPrompt")
      .mockResolvedValue("sess-1");

    renderPage();
    await userEvent.click(screen.getAllByText("Start workflow")[0]);

    await waitFor(() => expect(sendPrompt).toHaveBeenCalledTimes(1));
    expect(sendPrompt.mock.calls[0][0]).toContain("survey the literature on the topic");
    expect(await screen.findByText("live-page")).toBeInTheDocument();

    sendPrompt.mockRestore();
  });

  it("is safe when the local data surfaces fail", async () => {
    listNotebooks.mockRejectedValue(new Error("boom"));
    queryRuns.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("0 notebooks across your sessions")).toBeInTheDocument();
    expect(screen.getByText("0 runs recorded")).toBeInTheDocument();
  });
});