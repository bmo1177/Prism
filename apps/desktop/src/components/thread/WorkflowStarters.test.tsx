import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKFLOW_STARTERS, WorkflowStarters } from "./WorkflowStarters";

// Plain closures instead of vi.fn: tinyspy's result tracking derives an extra
// promise from a rejecting spy, which vitest then reports as unhandled.
const installCalls: string[] = [];
let failInstall = false;
vi.mock("@/lib/tauri", () => ({
  isTauri: true,
  installExample: async (name: string) => {
    installCalls.push(name);
    if (failInstall) throw new Error("resource missing");
    return name;
  },
}));

describe("WorkflowStarters", () => {
  beforeEach(() => {
    installCalls.length = 0;
    failInstall = false;
  });

  it("renders one card per starter workflow, including the climate example", () => {
    render(<WorkflowStarters onPick={() => {}} />);
    // Titles are i18n-translated (session:starters.<id>.title); WORKFLOW_STARTERS
    // itself no longer carries display copy, only ids/prompts — assert the
    // rendered English text directly.
    expect(screen.getByText("Run a demo analysis, end to end")).toBeInTheDocument();
    expect(screen.getByText("Analyze my data")).toBeInTheDocument();
    expect(screen.getByText("Audit a report for traceability")).toBeInTheDocument();
    expect(screen.getByText("Explore an example: climate trends")).toBeInTheDocument();
    expect(screen.getByText("Create a Word document")).toBeInTheDocument();
    expect(screen.getByText("Build a slide deck")).toBeInTheDocument();
    expect(screen.getByText("Build a spreadsheet")).toBeInTheDocument();
    expect(screen.getByText("Assemble a PDF")).toBeInTheDocument();
    expect(screen.getByText("Wireframe an idea")).toBeInTheDocument();
    expect(screen.getByText("Build an HTML slide deck")).toBeInTheDocument();
    expect(screen.getByText("Review a design")).toBeInTheDocument();
    // Phase 4 (science) starters land on the same empty-session on-ramp.
    expect(screen.getByText("Survey the literature")).toBeInTheDocument();
    expect(screen.getByText("Draft a paper-style report")).toBeInTheDocument();
    expect(screen.getByText("Reproduce an analysis")).toBeInTheDocument();
    expect(screen.getByText("Audit an analysis's integrity")).toBeInTheDocument();
    expect(WORKFLOW_STARTERS).toHaveLength(15);
  });

  it("sends prompts that invoke the bundled science skills", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);
    await userEvent.click(screen.getByText("Survey the literature"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0]).toContain("literature-review");
    expect(onPick.mock.calls[0][0]).toContain("citation-reviewer");

    await userEvent.click(screen.getByText("Draft a paper-style report"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(2));
    expect(onPick.mock.calls[1][0]).toContain("paper-to-report");

    await userEvent.click(screen.getByText("Reproduce an analysis"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(3));
    expect(onPick.mock.calls[2][0]).toContain("reproducible-research");
    expect(onPick.mock.calls[2][0]).toContain("figure-provenance");

    await userEvent.click(screen.getByText("Audit an analysis's integrity"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(4));
    expect(onPick.mock.calls[3][0]).toContain("domain-check");
    expect(onPick.mock.calls[3][0]).toContain("stats-integrity");
  });

  it("sends the full-workflow prompt on click", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);
    await userEvent.click(screen.getByText("Run a demo analysis, end to end"));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.stringContaining("figure1.png")));
    expect(onPick.mock.calls[0][0]).toContain("report.md");
    expect(installCalls).toHaveLength(0);
  });

  it("sends prompts that invoke the bundled office skills", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);
    await userEvent.click(screen.getByText("Create a Word document"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0]).toContain("docx skill");

    await userEvent.click(screen.getByText("Build a slide deck"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(2));
    expect(onPick.mock.calls[1][0]).toContain("pptx skill");

    await userEvent.click(screen.getByText("Build a spreadsheet"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(3));
    expect(onPick.mock.calls[2][0]).toContain("xlsx skill");
  });

  it("sends prompts that invoke the bundled design skills", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);
    await userEvent.click(screen.getByText("Wireframe an idea"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0]).toContain("wireframe-mobile-flow");

    await userEvent.click(screen.getByText("Review a design"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(2));
    expect(onPick.mock.calls[1][0]).toContain("critique skill");
  });

  it("sends a deck prompt that names the bundled deck visual styles", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);
    await userEvent.click(screen.getByText("Build an HTML slide deck"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0]).toContain("deck.html");
    expect(onPick.mock.calls[0][0]).toContain("blue-professional");
    expect(onPick.mock.calls[0][0]).toContain("8-bit-orbit");
  });

  it("installs the example files before sending the climate prompt", async () => {
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);

    await userEvent.click(screen.getByText("Explore an example: climate trends"));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(installCalls).toEqual(["climate-trends"]);
    expect(onPick.mock.calls[0][0]).toContain("gistemp_global_means.csv");
  });

  it("does not send the prompt when the example install fails", async () => {
    failInstall = true;
    const onPick = vi.fn();
    render(<WorkflowStarters onPick={onPick} />);

    await userEvent.click(screen.getByText("Explore an example: climate trends"));
    await waitFor(() => expect(installCalls).toHaveLength(1));
    expect(onPick).not.toHaveBeenCalled();
  });
});
