import type { FindingLevel, ReviewCheck, ReviewerBlock } from "@ai4s/shared";

const FENCE = /```review\s*\n([\s\S]*?)\n```/;
const LEVELS: ReadonlySet<string> = new Set(["ok", "warn", "error"]);
const CHECKS: ReadonlySet<string> = new Set(["citation", "number", "figure", "domain", "integrity"]);

/**
 * Extract a structured reviewer result the agent was asked to emit as a
 * ```review fenced JSON block. Returns the markdown without the fence plus
 * the parsed block, or review: null when absent/malformed.
 */
export function splitReview(markdown: string): { clean: string; review: ReviewerBlock | null } {
  // Fast path (#77): the SDK emits accumulated text on every streamed token,
  // so this runs on the whole growing reply each time. Without an opening AND
  // a closing fence the regex scan over megabytes per token starves the main
  // thread — plain indexOf needles (memmem) reject in O(1) when absent.
  // The closing check matters mid-stream: once ````review` starts, the fast
  // path must stay on until the fence closes, or every token pays a full
  // backtracking scan over the incomplete JSON.
  const fenceStart = markdown.indexOf("```review");
  if (fenceStart === -1 || markdown.indexOf("```", fenceStart + 9) === -1) {
    return { clean: markdown, review: null };
  }
  const m = FENCE.exec(markdown);
  if (!m) return { clean: markdown, review: null };
  let review: ReviewerBlock | null = null;
  try {
    const parsed = JSON.parse(m[1]) as {
      findings?: Array<{
        level?: string;
        title?: string;
        evidence?: string;
        check?: string;
        tag?: string;
      }>;
      note?: string;
    };
    const findings = (parsed.findings ?? [])
      .filter((f) => f.title)
      .map((f) => ({
        level: LEVELS.has(f.level ?? "") ? (f.level as FindingLevel) : "warn",
        title: String(f.title),
        evidence: f.evidence ? String(f.evidence) : undefined,
        check: CHECKS.has(f.check ?? "") ? (f.check as ReviewCheck) : undefined,
        tag: f.tag ? String(f.tag) : undefined,
      }));
    if (findings.length > 0 || parsed.note) {
      review = { kind: "reviewer", findings, note: parsed.note };
    }
  } catch {
    return { clean: markdown, review: null }; // malformed JSON: leave the text as-is
  }
  // Slice via the already-matched indices instead of a second full regex scan.
  const clean = review ? (markdown.slice(0, m.index) + markdown.slice(m.index + m[0].length)).trim() : markdown;
  return { clean, review };
}
