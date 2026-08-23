import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReasoningRow } from "./ReasoningRow";

const block = { kind: "reasoning" as const, text: "checking the dataset shape" };

describe("ReasoningRow", () => {
  it("streams open while thinking: live text under a Thinking… label", () => {
    render(<ReasoningRow block={block} streaming />);
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.getByText("checking the dataset shape")).toBeInTheDocument();
  });

  it("collapses to a Thought line once done, with a one-line preview", () => {
    render(<ReasoningRow block={block} />);
    expect(screen.getByText("Thought")).toBeInTheDocument();
    // Collapsed shows a truncated preview next to the label; the open body
    // (the full paragraph) stays hidden until expanded.
    expect(
      screen.queryByText("checking the dataset shape", { selector: "p" }),
    ).not.toBeInTheDocument();
  });

  it("collapses long thoughts to a truncated preview until expanded", () => {
    const long = { kind: "reasoning" as const, text: "x".repeat(200) };
    render(<ReasoningRow block={long} />);
    expect(screen.getByText("x".repeat(120) + "…")).toBeInTheDocument();
    expect(screen.queryByText("x".repeat(200))).not.toBeInTheDocument();
  });

  it("a done thought expands on click", () => {
    render(<ReasoningRow block={block} />);
    fireEvent.click(screen.getByText("Thought"));
    expect(screen.getByText("checking the dataset shape")).toBeInTheDocument();
  });
});
