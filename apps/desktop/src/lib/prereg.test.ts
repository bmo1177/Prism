import { describe, expect, it } from "vitest";
import { parsePrereg } from "./prereg";

describe("parsePrereg", () => {
  it("parses a valid prereg.v1 plan object", () => {
    const raw = JSON.stringify({
      schema: "prereg.v1",
      title: "Effect of condition on reaction time",
      created: "2026-08-23",
      hypotheses: [
        { id: "H1", statement: "Condition A reacts faster than condition B" },
      ],
      outcomes: ["rt_ms"],
      predictors: ["condition"],
      tests: [
        { id: "T1", function: "ttest_ind", variables: ["rt_ms", "condition"], hypothesis: "H1" },
      ],
      correction: { method: "fdr_bh" },
      seeds: [42],
      exclusions: ["rt_ms < 100"],
      n_min: 50,
    });

    const parsed = parsePrereg(raw);
    expect(parsed.schema).toBe("prereg.v1");
    expect(parsed.title).toBe("Effect of condition on reaction time");
    expect(parsed.created).toBe("2026-08-23");
    expect(parsed.hypotheses).toEqual([
      { id: "H1", statement: "Condition A reacts faster than condition B" },
    ]);
    expect(parsed.outcomes).toEqual(["rt_ms"]);
    expect(parsed.predictors).toEqual(["condition"]);
    expect(parsed.tests).toHaveLength(1);
    expect(parsed.tests?.[0].function).toBe("ttest_ind");
    expect(parsed.correction?.method).toBe("fdr_bh");
    expect(parsed.seeds).toEqual([42]);
    expect(parsed.exclusions).toEqual(["rt_ms < 100"]);
    expect(parsed.n_min).toBe(50);
  });

  it("throws when JSON is invalid or missing required schema", () => {
    expect(() => parsePrereg("invalid-json")).toThrow();
    expect(() => parsePrereg("[]")).toThrow("Preregistration plan must be a JSON object");
    expect(() => parsePrereg(JSON.stringify({ title: "No schema" }))).toThrow('missing required "schema"');
  });

  it("tolerates unknown and extra fields forward-compatibly", () => {
    const raw = JSON.stringify({
      schema: "prereg.v1",
      customMeta: "future-extension",
    });
    const parsed = parsePrereg(raw);
    expect(parsed.schema).toBe("prereg.v1");
    expect(parsed.customMeta).toBe("future-extension");
  });
});
