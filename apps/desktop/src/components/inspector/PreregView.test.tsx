import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PreregView } from "./PreregView";

const samplePlan = JSON.stringify({
  schema: "prereg.v1",
  title: "Effect of priming on decision latency",
  created: "2026-08-25",
  hypotheses: [
    { id: "H1", statement: "Primed participants decide faster than unprimed" },
  ],
  outcomes: ["latency_ms"],
  predictors: ["prime_condition"],
  tests: [
    { id: "T1", function: "ttest_ind", variables: ["latency_ms", "prime_condition"], hypothesis: "H1" },
  ],
  correction: { method: "fdr_bh" },
  seeds: [12345],
  n_min: 100,
  exclusions: ["latency_ms < 150"],
});

describe("PreregView", () => {
  it("renders structured overview with hypotheses and tests", () => {
    render(<PreregView filename="study.prereg.json" text={samplePlan} />);

    expect(screen.getByRole("heading", { name: "Effect of priming on decision latency" })).toBeInTheDocument();
    expect(screen.getByText("prereg.v1")).toBeInTheDocument();
    expect(screen.getAllByText("H1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Primed participants decide faster than unprimed")).toBeInTheDocument();
    expect(screen.getByText("latency_ms")).toBeInTheDocument();
    expect(screen.getByText("prime_condition")).toBeInTheDocument();
    expect(screen.getByText("ttest_ind")).toBeInTheDocument();
    expect(screen.getByText("fdr_bh")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("N ≥ 100")).toBeInTheDocument();
  });

  it("toggles between visual overview and raw code view", async () => {
    const user = userEvent.setup();
    render(<PreregView filename="study.prereg.json" text={samplePlan} />);

    // Toggle to raw code view
    const codeBtn = screen.getByRole("button", { name: /raw json/i });
    await user.click(codeBtn);

    // Toggle back to overview
    const overviewBtn = screen.getByRole("button", { name: /overview/i });
    await user.click(overviewBtn);

    // Back in overview
    expect(screen.getByRole("heading", { name: "Effect of priming on decision latency" })).toBeInTheDocument();
  });

  it("handles malformed JSON gracefully", () => {
    render(<PreregView filename="study.prereg.json" text="invalid json content" />);
    expect(screen.getByText(/could not read preregistration plan/i)).toBeInTheDocument();
  });
});
