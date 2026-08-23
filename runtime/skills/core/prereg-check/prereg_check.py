#!/usr/bin/env python3
"""Open Science — preregistration artifact checker (P1-6).

A `.prereg.json` artifact records the analysis plan BEFORE results exist:
hypotheses, outcomes, predictors, the exact statistical tests, the
multiplicity correction, seeds, and exclusion rules. This checker closes the
loop: it diffs the code that actually ran against the plan that was
registered, so deviations surface as structured findings instead of hiding in
a finished report. Deterministic and stdlib-only; it flags specific deviation
classes — it never certifies an analysis as sound.

Plan schema (prereg.v1) — only `schema` is required; unknown fields are
ignored (forward-compatible):

    {
      "schema": "prereg.v1",
      "title": "Effect of condition on reaction time",
      "created": "2026-08-23",
      "hypotheses": [{"id": "H1", "statement": "..."}],
      "outcomes": ["rt_ms"],
      "predictors": ["condition"],
      "tests": [{"id": "T1", "function": "ttest_ind",
                 "variables": ["rt_ms"], "hypothesis": "H1"}],
      "correction": {"method": "fdr_bh"},
      "seeds": [42],
      "exclusions": ["rt_ms < 100"],
      "n_min": 50
    }

Checks:
    prereg · schema         — a plan file that does not parse / declare prereg.v1.
    prereg · unplanned-test — a significance test ran that the plan never registered.
    prereg · missing-test   — a registered test never ran anywhere in the code.
    prereg · correction     — the plan promises a multiplicity correction; none in code.
    prereg · seed           — the plan declares seeds; randomised code sets none.

Usage:
    python prereg_check.py [files...]   # default: scan the workspace
Output: one ```review fenced JSON block on stdout.
"""
from __future__ import annotations

import ast
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# --------------------------------------------------------------------------- #
# Constants + patterns (stdlib-only, mirrors the sibling gates)
# --------------------------------------------------------------------------- #

_SCHEMA = "prereg.v1"

_TEST_FUNCS = {
    "ttest_ind", "ttest_rel", "ttest_1samp", "pearsonr", "spearmanr",
    "kendalltau", "f_oneway", "mannwhitneyu", "wilcoxon", "chi2_contingency",
    "kruskal", "ranksums", "linregress",
}
_CORRECTION = re.compile(
    r"multipletests|fdrcorrection|false_discovery|bonferroni|\bholm\b|"
    r"p_adjust|\.correct\b|multitest",
    re.IGNORECASE,
)
_RANDOM_USE = re.compile(
    r"\b(np\.random|numpy\.random|random\.(?:random|randint|sample|shuffle|choice)|"
    r"train_test_split|\.sample\(|bootstrap|permutation|resample|KFold|"
    r"StratifiedKFold|RandomForest|shuffle\s*=\s*True|rnorm|runif|rbinom|"
    r"sample\s*\()",
)
_SEED_SET = re.compile(
    r"(np\.random\.seed|numpy\.random\.seed|random\.seed|random_state\s*=|"
    r"set\.seed|default_rng\(\s*\d|seed\s*=\s*\d)",
)

_CODE_EXT = {".py", ".ipynb", ".r", ".R"}
_SKIP = {"node_modules", "__pycache__", ".git", ".openscience", ".venv", "venv"}
_PREREG_NAME = re.compile(r"prereg|pre-reg|analysis[_-]?plan", re.IGNORECASE)


@dataclass
class Finding:
    level: str  # "warn" | "error"
    tag: str
    title: str
    evidence: str


@dataclass
class Plan:
    path: str
    data: dict


@dataclass
class CodeFile:
    """One code file, parsed once and shared across checks."""

    path: str
    text: str
    tree: ast.AST | None = None  # populated for python
    lines: list[str] = field(default_factory=list)

    def snip(self, lineno: int) -> str:
        if 1 <= lineno <= len(self.lines):
            return f"{self.path}:{lineno}  {self.lines[lineno - 1].strip()}"
        return f"{self.path}:{lineno}"


def _call_name(node: ast.Call) -> str:
    f = node.func
    if isinstance(f, ast.Attribute):
        return f.attr
    if isinstance(f, ast.Name):
        return f.id
    return ""


def _planned_funcs(plans: list[Plan]) -> set[str]:
    out: set[str] = set()
    for p in plans:
        tests = p.data.get("tests")
        if isinstance(tests, list):
            for t in tests:
                if isinstance(t, dict) and isinstance(t.get("function"), str):
                    out.add(t["function"].strip().lower())
    return out & _TEST_FUNCS  # unknown function names are not judgeable


def _correction_method(data: dict) -> str | None:
    c = data.get("correction")
    if isinstance(c, dict) and isinstance(c.get("method"), str) and c["method"]:
        return c["method"]
    if isinstance(c, str) and c:
        return c
    return None


def _declares_seeds(data: dict) -> bool:
    s = data.get("seeds")
    return isinstance(s, list) and len(s) > 0


# --------------------------------------------------------------------------- #
# File classification + discovery
# --------------------------------------------------------------------------- #

def _is_plan_path(p: Path) -> bool:
    return p.suffix.lower() == ".json" and bool(_PREREG_NAME.search(p.stem))


def load_plan(path: Path) -> tuple[Plan | None, Finding | None]:
    """Parse one candidate .prereg.json → (plan, None) or (None, finding)."""
    where = str(path)
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as e:
        return None, Finding("error", "prereg · schema",
                             "Preregistration plan unreadable", f"{where}\n  {e}")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return None, Finding(
            "error", "prereg · schema", "Preregistration plan is not valid JSON",
            f"{where}\n  {e.msg} at line {e.lineno} — fix the syntax so the "
            "registered plan can be diffed against the code.",
        )
    if not isinstance(data, dict):
        return None, Finding(
            "error", "prereg · schema",
            "Preregistration plan must be a JSON object",
            f"{where}\n  top level is {type(data).__name__}, expected an object.")
    if data.get("schema") != _SCHEMA:
        got = data.get("schema", "<missing>")
        return None, Finding(
            "error", "prereg · schema",
            "Preregistration plan has no known schema version",
            f'{where}\n  "schema" is {got!r}, expected {_SCHEMA!r}. A plan '
            "without a version cannot be validated against future revisions.")
    return Plan(where, data), None


def load_code(path: Path) -> CodeFile | None:
    lang_python = path.suffix.lower() in {".py", ".ipynb"}
    if path.suffix.lower() not in _CODE_EXT:
        return None
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    if path.suffix.lower() == ".ipynb":
        try:
            nb = json.loads(raw)
        except json.JSONDecodeError:
            return None
        raw = "\n".join(
            "".join(c.get("source", []))
            for c in nb.get("cells", [])
            if c.get("cell_type") == "code"
        )
    ctx = CodeFile(path=str(path), text=raw, lines=raw.splitlines())
    if lang_python:
        try:
            ctx.tree = ast.parse(raw)
        except SyntaxError:
            ctx.tree = None
    return ctx


def discover(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in sorted(root.rglob("*")):
        if any(part in _SKIP or part.startswith(".") for part in p.parts):
            continue
        if p.is_file() and (_is_plan_path(p) or p.suffix in _CODE_EXT):
            out.append(p)
    return out


# --------------------------------------------------------------------------- #
# Checks
# --------------------------------------------------------------------------- #

def check_unplanned_tests(plans: list[Plan], code: list[CodeFile]) -> list[Finding]:
    planned = _planned_funcs(plans)
    if not planned:
        return []  # a plan registering no tests leaves HARKing to stats-integrity
    out: list[Finding] = []
    for ctx in code:
        if ctx.tree is None:
            continue
        seen: set[str] = set()
        for node in ast.walk(ctx.tree):
            if not isinstance(node, ast.Call):
                continue
            name = _call_name(node)
            if name in _TEST_FUNCS and name not in planned and name not in seen:
                seen.add(name)
                out.append(Finding(
                    "warn", "prereg · unplanned-test",
                    f"{name}() ran but is not in the preregistration",
                    ctx.snip(getattr(node, "lineno", 1))
                    + f"\n  the registered plan names {sorted(planned)}, not "
                    f"`{name}` — a test chosen after seeing the data is the "
                    "HARKing path the plan exists to close. Register it in a "
                    "revised plan or label this analysis exploratory.",
                ))
    return out


def check_missing_tests(plans: list[Plan], code: list[CodeFile]) -> list[Finding]:
    planned = _planned_funcs(plans)
    if not planned:
        return []
    ran: set[str] = set()
    for ctx in code:
        if ctx.tree is None:
            continue
        for node in ast.walk(ctx.tree):
            if isinstance(node, ast.Call) and _call_name(node) in planned:
                ran.add(_call_name(node))
    out: list[Finding] = []
    for name in sorted(planned - ran):
        out.append(Finding(
            "warn", "prereg · missing-test",
            f"Registered test `{name}` never ran",
            plans[0].path
            + f"\n  the plan registers `{name}` but no code file calls it — "
            "either the planned analysis was skipped (report why) or it ran "
            "somewhere the workspace does not cover. An incomplete plan "
            "execution weakens the confirmatory claim.",
        ))
    return out


def check_correction(plans: list[Plan], code: list[CodeFile]) -> list[Finding]:
    method = next((_correction_method(p.data) for p in plans
                   if _correction_method(p.data)), None)
    if not method or not code:
        return []
    if any(_CORRECTION.search(c.text) for c in code):
        return []
    ctx = code[0]
    return [Finding(
        "error", "prereg · correction",
        "Registered multiplicity correction absent from the code",
        ctx.snip(1)
        + f"\n  the plan promises a `{method}` correction but no "
        "multipletests/FDR/Bonferroni call appears anywhere — uncorrected "
        "p-values inflate the family-wise error rate exactly as if no plan "
        "existed. Apply the registered correction before reporting.",
    )]


def check_seeds(plans: list[Plan], code: list[CodeFile]) -> list[Finding]:
    if not any(_declares_seeds(p.data) for p in plans):
        return []
    out: list[Finding] = []
    for ctx in code:
        use = _RANDOM_USE.search(ctx.text)
        if use and not _SEED_SET.search(ctx.text):
            out.append(Finding(
                "warn", "prereg · seed",
                "Randomised code sets none of the registered seeds",
                ctx.snip(_line_of(ctx.text, use.start()))
                + "\n  the plan registers fixed seeds, but this file uses "
                "randomness with no seed set (np.random.seed / random_state= / "
                "set.seed) — the run will not reproduce against the plan.",
            ))
    return out


def _line_of(text: str, idx: int) -> int:
    return text[:idx].count("\n") + 1


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #

NOTE = (
    "Preregistration gate — diffs executed code against the registered "
    ".prereg.json plan (schema, tests, correction, seeds). It flags these "
    "specific deviation classes only; absence of findings does not certify "
    "the analysis is sound or that the plan was followed in spirit."
)


def analyze(plans: list[Plan], code: list[CodeFile]) -> list[Finding]:
    out: list[Finding] = []
    seen: set[tuple[str, str, str]] = set()
    checks = [check_unplanned_tests, check_missing_tests,
              check_correction, check_seeds]
    for check in checks:
        try:
            found = check(plans, code)
        except Exception:  # a buggy rule must never crash the whole gate
            continue
        for f in found:
            key = (f.tag, f.title, f.evidence)
            if key not in seen:
                seen.add(key)
                out.append(f)
    return out


def run(paths: list[str]) -> dict:
    targets = [Path(p) for p in paths] if paths else discover(Path.cwd())
    plans: list[Plan] = []
    findings: list[Finding] = []
    code: list[CodeFile] = []
    for t in targets:
        if _is_plan_path(t):
            plan, problem = load_plan(t)
            if plan:
                plans.append(plan)
            if problem:
                findings.append(problem)
        else:
            ctx = load_code(t)
            if ctx:
                code.append(ctx)
    findings += analyze(plans, code)
    return {
        "findings": [
            {"level": f.level, "check": "prereg", "tag": f.tag,
             "title": f.title, "evidence": f.evidence}
            for f in findings
        ],
        "note": NOTE,
    }


def main(argv: list[str]) -> int:
    print("```review")
    print(json.dumps(run(argv[1:]), ensure_ascii=False))
    print("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
