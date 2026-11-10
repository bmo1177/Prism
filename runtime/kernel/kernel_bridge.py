#!/usr/bin/env python3
"""Minimal local Python kernel for the AI4S Workbench notebook.

A persistent process that holds one namespace across cells (shared state, like a
Jupyter kernel) and speaks a line-delimited JSON protocol over stdin/stdout:

    request : {"id": "<str>", "code": "<str>"}\\n
    response: {"id","ok","stdout","result","error","images"}\\n

Standard library only — no ipykernel/ZMQ — so it runs against whatever Python the
user has, offline, with no model key. `result` mirrors Jupyter: the repr of the
final expression when a cell ends in one, else null. `images` lists base64 PNGs
of the matplotlib figures the cell created, shown under the cell like Jupyter's
inline figures: the headless "Agg" backend is forced before any user import (so
`plt.plot(...)` buffers into the notebook instead of opening a native window),
and figures created *during* a cell are captured once and left open for later
cells to iterate on.

Self check (verifiable with one command, no notebook needed):
    python3 kernel_bridge.py --self-test
"""
import ast
import base64
import io
import json
import os
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout

# The headless backend must be selected before matplotlib is ever imported in
# this process — a user cell that says `import matplotlib.pyplot as plt` must
# land on Agg (buffers, no display), never on an OS GUI backend.
os.environ.setdefault("MPLBACKEND", "Agg")

# Kernel-state for the capture diary: the pyplot module (None when matplotlib
# is not installed) plus the figure numbers known before each cell, so only
# figures a cell CREATED are reported under it (later cells do not re-emit
# earlier figures). A keyring-free plain dict keeps the protocol surface tiny.
_plot: dict = {"plt": None, "known": set()}


def _pyplot_fignums() -> set:
    """Figure numbers known to pyplot right now, or nothing without it."""
    plt = _plot["plt"]
    return set(plt.get_fignums()) if plt is not None else set()


def _capture_new_figures() -> list:
    """Render every new figure as base64 PNG and adopt the seen-set. Capture
    problems degrade to no image — a hostile backend must not kill a cell."""
    plt = _plot["plt"]
    if plt is None:
        return []
    after = _pyplot_fignums()
    images = []
    try:
        for num in sorted(after - _plot["known"]):
            buf = io.BytesIO()
            plt.figure(num).savefig(buf, format="png", dpi=110)
            images.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    except Exception:
        return []
    _plot["known"] = after
    return images


def run_cell(ns: dict, code: str):
    """Execute `code` in namespace `ns`.
    Returns (stdout, result_repr_or_None, error_or_None, captured_images)."""
    out = io.StringIO()
    try:
        parsed = ast.parse(code, mode="exec")
    except SyntaxError:
        return "", None, traceback.format_exc(limit=1), []

    body = parsed.body
    result = None
    # Jupyter behaviour: if the cell ends in an expression, show its value.
    tail_expr = None
    if body and isinstance(body[-1], ast.Expr):
        last = body.pop()
        assert isinstance(last, ast.Expr)
        tail_expr = ast.Expression(last.value)

    try:
        with redirect_stdout(out), redirect_stderr(out):
            if body:
                exec(compile(ast.Module(body, []), "<cell>", "exec"), ns)  # noqa: S102
            if tail_expr is not None:
                value = eval(compile(tail_expr, "<cell>", "eval"), ns)  # noqa: S307
                if value is not None:
                    result = repr(value)
    except Exception:  # surface the traceback to the notebook, like a kernel does
        error = traceback.format_exc()
    else:
        error = None

    # Figures a cell drew are reported even when the cell then raised — Jupyter
    # does the same (its display hook fires at first draw, before the raise).
    return out.getvalue(), result, error, _capture_new_figures()


def main() -> None:
    # Force UTF-8 on the stdio protocol regardless of the OS locale. On Windows,
    # piped stdin/stdout default to the ANSI code page (e.g. cp936/GBK), which
    # corrupts non-ASCII source like `print("中文")` before it is executed. This
    # is self-contained (independent of how the process is spawned); a no-op
    # where stdio is already UTF-8.
    for stream in (sys.stdin, sys.stdout):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")

    # Pre-wire matplotlib in THIS interpreter: Agg (selected via the environment
    # above) plus a live pyplot so figure numbers can be diffed per cell. A
    # machine without matplotlib still runs every cell — only the figures stay
    # off the responses.
    try:
        import matplotlib  # deferred: the bridge must start even when it's absent

        matplotlib.use("Agg", force=True)
        import matplotlib.pyplot as plt

        _plot.update(plt=plt, known=set(plt.get_fignums()))
    except Exception:
        pass

    ns: dict = {"__name__": "__main__"}
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        stdout, result, error, images = run_cell(ns, req.get("code", ""))
        resp = {
            "id": req.get("id"),
            "ok": error is None,
            "stdout": stdout,
            "result": result,
            "error": error,
            "images": images,
        }
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


def _self_test() -> None:
    """One-command check of capture + tail expressions, no notebook needed."""
    import matplotlib.pyplot as plt

    _plot.update(plt=plt, known=set(plt.get_fignums()))
    ns: dict = {}
    _, _, err, images = run_cell(ns, "import matplotlib.pyplot as p\np.figure(); p.plot([1, 2], [3, 4])")
    assert err is None, err
    assert images and images[0].startswith("iVBOR"), "no PNG captured"
    # A later cell that creates a NEW figure appends it; drawing INTO the
    # existing figure (p.plot again) is an edit, not a new figure — Jupyter
    # re-shows it, our capture lets the next explicit figure prove freshness.
    _, _, err2, images2 = run_cell(ns, "p.figure(); p.scatter([0], [1])")
    assert err2 is None, err2
    assert images2 and images2[0].startswith("iVBOR"), "second figure not captured"
    _, _, err3, images3 = run_cell(ns, "40 + 2")
    assert err3 is None and images3 == [], "tail expression should add no figures"
    assert _plot["known"] == set(plt.get_fignums()), "figure baseline not adopted"
    print("kernel_bridge self-test: OK")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        _self_test()
    else:
        main()
