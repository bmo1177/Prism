#!/usr/bin/env python3
"""Tests for the preregistration artifact checker (runtime/skills/core/prereg-check).

Run: python scripts/dev/test_prereg_check.py
Stdlib unittest only — no pytest dependency.
"""
import importlib.util
import json
import sys
import tempfile
import os
import unittest
from pathlib import Path

sys.dont_write_bytecode = True  # never leave __pycache__ in the shipped skill dir

_MOD = (
    Path(__file__).resolve().parents[2]
    / "runtime/skills/core/prereg-check/prereg_check.py"
)
_spec = importlib.util.spec_from_file_location("prereg_check", _MOD)
assert _spec and _spec.loader
pc = importlib.util.module_from_spec(_spec)
sys.modules["prereg_check"] = pc  # dataclass annotation resolution needs this
_spec.loader.exec_module(pc)


def write(tmp: str, name: str, content: str) -> str:
    p = os.path.join(tmp, name)
    with open(p, "w") as fh:
        fh.write(content)
    return p


def plan_json(**overrides) -> str:
    plan = {
        "schema": "prereg.v1",
        "title": "Effect of condition on reaction time",
        "tests": [
            {"id": "T1", "function": "ttest_ind", "variables": ["rt_ms"]},
        ],
        "correction": {"method": "fdr_bh"},
        "seeds": [42],
    }
    plan.update(overrides)
    for k, v in list(plan.items()):
        if v is None:
            del plan[k]
    return json.dumps(plan, indent=2)


CODE_MATCHING = (
    "import numpy as np\n"
    "from scipy import stats\n"
    "from statsmodels.stats.multitest import multipletests\n"
    "np.random.seed(42)\n"
    "sampled = np.random.choice(n, size=100)\n"
    "t, p = stats.ttest_ind(a, b)\n"
    "multipletests([p], method='fdr_bh')\n"
)


class Schema(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def findings(self, plan_text: str | None, code: str = CODE_MATCHING):
        paths = []
        if plan_text is not None:
            paths.append(write(self.tmp, "study.prereg.json", plan_text))
        paths.append(write(self.tmp, "analysis.py", code))
        return pc.run(paths)["findings"]

    def test_valid_plan_no_findings(self):
        self.assertEqual(self.findings(plan_json()), [])

    def test_invalid_json_flagged(self):
        fs = self.findings("{not json")
        self.assertTrue(any(f["tag"] == "prereg · schema" for f in fs))

    def test_missing_schema_field_flagged(self):
        fs = self.findings('{"title": "no schema key"}')
        self.assertTrue(any("schema version" in f["title"].lower() for f in fs))

    def test_unknown_schema_version_flagged(self):
        fs = self.findings(plan_json(schema="prereg.v9"))
        self.assertTrue(any(f["tag"] == "prereg · schema" for f in fs))

    def test_non_object_plan_flagged(self):
        fs = self.findings("[1, 2, 3]")
        self.assertTrue(any("JSON object" in f["title"] for f in fs))


class Deviations(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def run_with(self, plan_text: str, code: str):
        paths = [
            write(self.tmp, "study.prereg.json", plan_text),
            write(self.tmp, "analysis.py", code),
        ]
        return pc.run(paths)["findings"]

    def test_unplanned_test_flagged(self):
        code = CODE_MATCHING + "r, p2 = stats.pearsonr(x, y)\n"
        fs = self.run_with(plan_json(), code)
        self.assertTrue(any(
            f["tag"] == "prereg · unplanned-test" and "pearsonr" in f["title"]
            for f in fs))

    def test_registered_test_silent(self):
        fs = self.run_with(plan_json(), CODE_MATCHING)
        self.assertNotIn("prereg · unplanned-test", {f["tag"] for f in fs})

    def test_missing_test_flagged(self):
        # Two planned tests; the code only ever runs ttest_ind.
        plan = plan_json(tests=[
            {"id": "T1", "function": "ttest_ind"},
            {"id": "T2", "function": "chi2_contingency"},
        ])
        fs = self.run_with(plan, CODE_MATCHING)
        self.assertTrue(any(
            f["tag"] == "prereg · missing-test" and "chi2_contingency" in f["title"]
            for f in fs))

    def test_correction_promised_but_absent(self):
        code = (
            "from scipy import stats\n"
            "t, p = stats.ttest_ind(a, b)\n"
        )
        fs = self.run_with(plan_json(), code)
        tags = {f["tag"] for f in fs}
        self.assertIn("prereg · correction", tags)
        # This code uses no randomness, so the seed rule stays silent.
        self.assertNotIn("prereg · seed", tags)

    def test_correction_present_ok(self):
        fs = self.run_with(plan_json(), CODE_MATCHING)
        self.assertNotIn("prereg · correction", {f["tag"] for f in fs})

    def test_correction_as_string_method_ok(self):
        plan = json.dumps({
            "schema": "prereg.v1",
            "correction": "bonferroni",
            "tests": [{"id": "T1", "function": "ttest_ind"}],
        })
        code = (
            "from scipy import stats\n"
            "p_adj = [min(p * len(ps), 1.0) for p in (ps := [stats.ttest_ind(a, b)[1]])]\n"
            "# bonferroni applied manually above\n"
        )
        fs = self.run_with(plan, code)
        self.assertNotIn("prereg · correction", {f["tag"] for f in fs})

    def test_seeds_declared_unseeded_randomness(self):
        code = (
            "import numpy as np\n"
            "from scipy import stats\n"
            "idx = np.random.choice(n, size=100)\n"
            "t, p = stats.ttest_ind(a, b)\n"
        )
        fs = self.run_with(plan_json(), code)
        self.assertTrue(any(f["tag"] == "prereg · seed" for f in fs))
        self.assertTrue(any(
            f["tag"] == "prereg · correction" for f in fs))  # also promised, absent

    def test_plan_without_tests_disables_test_diffs(self):
        # A plan registering no tests leaves HARKing detection to stats-integrity.
        plan = '{"schema": "prereg.v1", "title": "descriptive only"}'
        fs = self.run_with(plan, "from scipy import stats\nstats.ttest_ind(a, b)\n")
        self.assertEqual({f["tag"] for f in fs}, set())

    def test_no_plan_files_graceful(self):
        paths = [write(self.tmp, "only_code.py", "x = 1\n")]
        self.assertEqual(pc.run(paths)["findings"], [])


class NotebookAndR(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def test_notebook_code_diffed(self):
        nb = {
            "cells": [{
                "cell_type": "code",
                "source": ["from scipy import stats\\n",
                           "r, p = stats.spearmanr(x, y)\\n"],
            }],
            "metadata": {},
        }
        plan_p = write(self.tmp, "study.prereg.json",
                       plan_json(correction=None, seeds=None))
        nb_p = write(self.tmp, "nb.ipynb", json.dumps(nb).replace("\\\\n", "\\n"))
        res = pc.run([plan_p, nb_p])
        self.assertTrue(any(
            f["tag"] == "prereg · unplanned-test" and "spearmanr" in f["title"]
            for f in res["findings"]))

    def test_r_file_checked_for_seed_only(self):
        r_code = "idx <- sample(1:n, 100)\n"
        plan_p = write(self.tmp, "study.prereg.json", plan_json())
        r_p = write(self.tmp, "analysis.R", r_code)
        res = pc.run([plan_p, r_p])
        tags = {f["tag"] for f in res["findings"]}
        self.assertIn("prereg · seed", tags)
        # R test calls are not diffed against the plan (documented limit).
        self.assertNotIn("prereg · unplanned-test", tags)


class Contract(unittest.TestCase):
    def test_review_contract_shape(self):
        tmp = tempfile.mkdtemp()
        p = write(tmp, "bad.prereg.json", "{oops")
        res = pc.run([p])
        self.assertIn("findings", res)
        self.assertIn("note", res)
        f0 = res["findings"][0]
        self.assertEqual(f0["check"], "prereg")
        self.assertIn("tag", f0)
        self.assertNotIn("no error", res["note"].lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
