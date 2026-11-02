/**
 * Preregistration artifact model & parser (P1-6, social science / open science).
 * Parses and validates versioned preregistration plan artifacts (`prereg.v1`),
 * matching the contract defined in runtime/skills/core/prereg-check/.
 */

export interface PreregHypothesis {
  id: string;
  statement: string;
}

export interface PreregTest {
  id?: string;
  function: string;
  variables?: string[];
  hypothesis?: string;
}

export interface PreregCorrection {
  method: string;
}

export interface PreregPlan {
  schema: string;
  title?: string;
  created?: string;
  hypotheses?: PreregHypothesis[];
  outcomes?: string[];
  predictors?: string[];
  tests?: PreregTest[];
  correction?: PreregCorrection;
  seeds?: number[];
  exclusions?: string[];
  n_min?: number;
  [key: string]: unknown;
}

/** Parse and validate a preregistration plan JSON string. */
export function parsePrereg(text: string): PreregPlan {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Preregistration plan must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  const schema = typeof obj.schema === "string" ? obj.schema : "";
  if (!schema) {
    throw new Error('Preregistration plan missing required "schema" field');
  }

  const hypotheses: PreregHypothesis[] = [];
  if (Array.isArray(obj.hypotheses)) {
    for (const item of obj.hypotheses) {
      if (item && typeof item === "object") {
        const h = item as Record<string, unknown>;
        const id = String(h.id ?? "");
        const statement = String(h.statement ?? "");
        if (id || statement) {
          hypotheses.push({ id: id || `H${hypotheses.length + 1}`, statement });
        }
      }
    }
  }

  const tests: PreregTest[] = [];
  if (Array.isArray(obj.tests)) {
    for (const item of obj.tests) {
      if (item && typeof item === "object") {
        const t = item as Record<string, unknown>;
        const fn = String(t.function ?? "").trim();
        if (fn) {
          const vars = Array.isArray(t.variables) ? t.variables.map(String) : undefined;
          const hyp = t.hypothesis !== undefined ? String(t.hypothesis) : undefined;
          const id = t.id !== undefined ? String(t.id) : undefined;
          tests.push({ id, function: fn, variables: vars, hypothesis: hyp });
        }
      }
    }
  }

  const outcomes = Array.isArray(obj.outcomes) ? obj.outcomes.map(String) : undefined;
  const predictors = Array.isArray(obj.predictors) ? obj.predictors.map(String) : undefined;
  const exclusions = Array.isArray(obj.exclusions) ? obj.exclusions.map(String) : undefined;
  const seeds = Array.isArray(obj.seeds)
    ? obj.seeds.map((s) => Number(s)).filter((n) => !Number.isNaN(n))
    : undefined;

  let correction: PreregCorrection | undefined;
  if (obj.correction && typeof obj.correction === "object") {
    const c = obj.correction as Record<string, unknown>;
    if (typeof c.method === "string" && c.method.trim()) {
      correction = { method: c.method.trim() };
    }
  }

  const n_min = typeof obj.n_min === "number" && !Number.isNaN(obj.n_min) ? obj.n_min : undefined;
  const title = typeof obj.title === "string" ? obj.title.trim() : undefined;
  const created = typeof obj.created === "string" ? obj.created.trim() : undefined;

  return {
    ...obj,
    schema,
    title,
    created,
    hypotheses: hypotheses.length > 0 ? hypotheses : undefined,
    outcomes: outcomes && outcomes.length > 0 ? outcomes : undefined,
    predictors: predictors && predictors.length > 0 ? predictors : undefined,
    tests: tests.length > 0 ? tests : undefined,
    correction,
    seeds: seeds && seeds.length > 0 ? seeds : undefined,
    exclusions: exclusions && exclusions.length > 0 ? exclusions : undefined,
    n_min,
  };
}
