import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProvenancePage } from "./ProvenancePage";
import type { ProvenanceRecord } from "@ai4s/shared";

// Force the data path (the trail lives on the Rust side, like Notebooks/Runs).
vi.mock("@/lib/tauri", () => ({ isTauri: true }));
const queryProvenance = vi.fn();
vi.mock("@/lib/provenance", () => ({
  queryProvenance: (q: unknown) => queryProvenance(q),
}));
const listRuns = vi.fn();
vi.mock("@/lib/runs", () => ({
  listRuns: () => listRuns(),
  reproduceRunPrompt: (run: { runId: string }) => `Reproduce ${run.runId}`,
}));

const R0: ProvenanceRecord = {
  path: "analysis/figure1.py",
  version: 2,
  ts: 1720000100,
  tool: "edit",
  sessionId: "ses_1",
  model: "claude-4",
  log: "Fixed ylabel",
  diff: "@@ -1,2 +1,2 @@\n-foo\n+bar",
};
const R1: ProvenanceRecord = {
  path: "notes.md",
  version: 1,
  ts: 1720000000,
  tool: "write",
  sessionId: "ses_2",
  content: "# Notes\n\nHello",
  log: "wrote notes.md",
};

function PAGE(): { rows: ProvenanceRecord[]; total: number; next?: number } {
  return { rows: [R0, R1], total: 2 };
}

function LiveProbe() {
  const { sessionId } = useParams();
  return <div>live-page {sessionId ?? ""}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/provenance"]}>
      <Routes>
        <Route path="/provenance" element={<ProvenancePage />} />
        <Route path="/live/:sessionId" element={<LiveProbe />} />
        <Route path="/live" element={<div>live-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProvenancePage", () => {
  beforeEach(() => {
    queryProvenance.mockReset();
    listRuns.mockReset();
    listRuns.mockResolvedValue([]);
  });

  it("lists recorded versions newest first with searchable rows and expandable details", async () => {
    queryProvenance.mockResolvedValue(PAGE());
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Provenance" })).toBeInTheDocument();
    expect(await screen.findByText("2 written versions")).toBeInTheDocument();

    // Newest version first (the store returns newest-first on both the Rust and
    // fixture side), each row is a row with an expandable detail.
    const rows = await screen.findAllByRole("button", { expanded: false });
    expect(rows[0]).toHaveTextContent("analysis/figure1.py");
    expect(rows[0]).toHaveTextContent("v2");

    await userEvent.click(rows[0]);
    // The expanded detail shows the recorded lineage (an edit keeps its diff)
    // and the model that made the change.
    expect(await screen.findByText("claude-4")).toBeInTheDocument();
    expect(screen.getByText("Fixed ylabel")).toBeInTheDocument();

    // The authored-write row carries content, so it gains the Reproduce action.
    expect(await screen.getAllByText("Open conversation").length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByText("notes.md"));
    expect(await screen.findByText("Reproduce")).toBeInTheDocument();
  });

  it("re-queries from the top when the search box changes", async () => {
    queryProvenance.mockResolvedValue(PAGE());
    renderPage();
    await screen.findByText("2 written versions");

    await userEvent.type(screen.getByRole("textbox"), "figure1");
    await waitFor(
      () =>
        expect(
          queryProvenance.mock.calls.some(([q]) => (q as { search?: string }).search === "figure1"),
        ).toBe(true),
      { timeout: 2000 },
    );
    expect(queryProvenance.mock.calls[queryProvenance.mock.calls.length - 1]?.[0]).toEqual({
      search: "figure1",
      beforeIndex: undefined,
      limit: 50,
    });
  });

  it("loads more pages via the keyset cursor and keeps the conversation link", async () => {
    queryProvenance
      .mockResolvedValueOnce({ rows: [R0], total: 2, next: 3 })
      .mockResolvedValueOnce({ rows: [R1], total: 2, next: undefined });
    renderPage();

    expect(await screen.findByText("analysis/figure1.py")).toBeInTheDocument();
    // Only the first page's row is loaded yet — the second is paged in.
    expect(screen.queryByText("notes.md")).toBeNull();
    await userEvent.click(screen.getByText("Load more"));

    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());
    expect(queryProvenance).toHaveBeenLastCalledWith({
      search: "",
      beforeIndex: 3,
      limit: 50,
    });
    expect(screen.getByText("notes.md")).toBeInTheDocument();

    // Reproducing an authored file drafts into its own conversation.
    await userEvent.click(screen.getByText("notes.md"));
    await userEvent.click(await screen.findByText("Reproduce"));
    await waitFor(() => expect(screen.getByText(/live-page ses_2/)).toBeInTheDocument());
  });

  it("is safe when the store query fails", async () => {
    queryProvenance.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("No provenance recorded yet — start a session and the agent's writes will appear here.")).toBeInTheDocument();
  });
});