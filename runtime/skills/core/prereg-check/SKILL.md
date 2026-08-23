---
name: prereg-check
description: Use whenever a workspace contains a preregistration plan (.prereg.json) alongside analysis code — before reporting results and again as the final gate. Diffs the code that actually ran against the registered plan (statistical tests, multiplicity correction, seeds) and flags deviations: unregistered tests (HARKing), registered tests that never ran, promised corrections missing from code, and unseeded randomness. Surfaces structured findings; never claims the analysis followed the plan in spirit.
---

# Preregistration artifact checker

A preregistration plan only has teeth if someone checks the finished analysis
against it. This skill closes that loop deterministically: it reads the
workspace's `.prereg.json` artifact, parses the code that actually ran, and
reports every deviation as a structured finding — before deviations hide
inside a polished report.

Run it on any analysis with a registered plan — fast, offline, stdlib-only.

## When to run

- **Before reporting results** from an analysis that has a `.prereg.json`.
- **After writing analysis code**, to confirm it matches the registered plan
  before executing.
- Whenever the user asks whether an analysis stayed true to its plan.

## The plan artifact (`prereg.v1`)

One JSON file per study, named `*.prereg.json` (or `analysis-plan.json`),
written BEFORE results exist. Only `schema` is required; unknown fields are
ignored so the schema can evolve without breaking old plans.

```json
{
  "schema": "prereg.v1",
  "title": "Effect of condition on reaction time",
  "created": "2026-08-23",
  "hypotheses": [
    { "id": "H1", "statement": "Condition A reacts faster than condition B" }
  ],
  "outcomes": ["rt_ms"],
  "predictors": ["condition"],
  "tests": [
    { "id": "T1", "function": "ttest_ind",
      "variables": ["rt_ms", "condition"], "hypothesis": "H1" },
    { "id": "T2", "function": "chi2_contingency",
      "variables": ["condition", "outcome"], "hypothesis": "H2" }
  ],
  "correction": { "method": "fdr_bh" },
  "seeds": [42],
  "exclusions": ["rt_ms < 100 or rt_ms > 5000"],
  "n_min": 50
}
```

Field notes:

- `tests[].function` — the exact callable name (`ttest_ind`, `pearsonr`,
  `f_oneway`, `chi2_contingency`, …). Only these known names are diffable.
- `correction.method` — promise of a multiple-comparison correction
  (`fdr_bh`, `bonferroni`, `holm`, …); the gate verifies the code delivers.
- `seeds` — seeds the run must reproduce against.

## How to run

```bash
python "$XDG_CONFIG_HOME/opencode/skills/prereg-check/prereg_check.py" \
    study.prereg.json analysis.py notebook.ipynb ...
# or scan the workspace for plans + code:
python "$XDG_CONFIG_HOME/opencode/skills/prereg-check/prereg_check.py"
```

It prints exactly one ` ```review ` fenced JSON block on stdout.

## What it catches

- **prereg · schema** — a plan file that is not valid JSON, not an object, or
  does not declare `"schema": "prereg.v1"`.
- **prereg · unplanned-test** — a significance test runs in code that the plan
  never registered (the classic HARKing path).
- **prereg · missing-test** — a test the plan registers never appears in any
  code file (incomplete plan execution weakens the confirmatory claim).
- **prereg · correction** — the plan promises a multiplicity correction but no
  `multipletests`/FDR/Bonferroni call exists anywhere in the code.
- **prereg · seed** — the plan declares seeds but randomised code sets none.

Known limits: test diffing covers Python (`.py` / `.ipynb`) via AST; R files
are checked for seeds only; variable-level checks stay with `stats-integrity`.

## Reporting findings

Copy the ` ```review ` block the tool prints as the **last thing** in your
message — the app renders it as dismissible reviewer cards. If the gate found
nothing, say the code matches the *registered* plan and keep the block (its
`note` states this is not a guarantee of soundness). Never claim the analysis
followed the plan "in spirit" — the gate checks specific deviation classes
only.
