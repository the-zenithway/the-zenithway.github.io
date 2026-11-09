"""Write clean, compilable LaTeX problem files from the reviewed Calculus banks.

The reviewed JSON (data/calculus-reviewed -> data/calculus-{c,t}-bank.json) is the
single source of truth. This script renders it back to real LaTeX, one file per
chapter and set type (C1-C12, T1-T10), replacing the old PDF-extracted .tex files.

Usage:
    python3 scripts/build_calculus_tex.py [--dest DIR]

Files are written to sources/calculus/ in this repo (C1_..., T1_..., flat). Pass
--dest to write somewhere else, e.g. a scratch directory to test-compile.
Figures are referenced relative to the repo root, so keep the files under
sources/calculus/ (or adjust GRAPHICS).
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEST = ROOT / "sources/calculus"
GRAPHICS = "../../"  # repo root, relative to sources/calculus/

SLUGS = {
    1: "Functions", 2: "Limits_and_Continuity", 3: "Differentiation",
    4: "Applications_of_Differential_Calculus", 5: "Antidifferentiation",
    6: "Definite_Integrals", 7: "Application_of_Integration_to_Geometry",
    8: "Further_Applications_of_Integration", 9: "Differential_Equations",
    10: "Sequences_and_Series", 11: "Misc_MCQ", 12: "Misc_FRQ",
}

HEADER = r"""% GENERATED FILE - do not hand-edit.
% Source of truth: data/calculus-reviewed/{kind}-{n}.json in the zenith-website repo.
% Regenerate with: python3 scripts/build_calculus_tex.py
\documentclass[11pt]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage{{amsmath,amssymb}}
\usepackage{{graphicx}}
\usepackage[margin=1in]{{geometry}}
\graphicspath{{{{{graphics}/}}}}
\setlength{{\parindent}}{{0pt}}
\setlength{{\parskip}}{{0.6em}}
\begin{{document}}
\section*{{{title}}}
"""

MATH = re.compile(r"(\$\$.*?\$\$|\$.*?\$|\\\[.*?\\\])", re.S)


def escape_text(segment):
    """Escape characters that are special in LaTeX text mode (outside math)."""
    return re.sub(r"(?<!\\)([%&#_])", r"\\\1", segment)


def render(text):
    parts = MATH.split(text.strip())
    return "".join(p if MATH.fullmatch(p) else escape_text(p) for p in parts)


def render_problem(p):
    out = ["", r"\bigskip\noindent\textbf{%s.}\ %s" % (p["id"], render(p["stem_tex"]))]
    fig = p.get("figure")
    if fig:
        out.append(r"\begin{center}\includegraphics[width=0.6\linewidth]{%s}\end{center}" % fig["src"])
    choices = p.get("choices_tex")
    if choices:
        out.append(r"\begin{list}{}{\setlength{\leftmargin}{3em}\setlength{\labelwidth}{2.5em}"
                   r"\setlength{\itemsep}{0pt}\setlength{\topsep}{2pt}}")
        for letter, choice in zip("ABCD", choices):
            out.append(r"\item[(%s)] %s" % (letter, render(choice)))
        out.append(r"\end{list}")
    return "\n".join(out)


def target_path(dest, n, kind):
    base = Path(dest) if dest else DEFAULT_DEST
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{kind.upper()}{n}_{SLUGS[int(n)]}_Problems.tex"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", help="write into DEST instead of sources/calculus")
    args = ap.parse_args()
    total = 0
    for kind in ("c", "t"):
        bank = json.loads((ROOT / f"data/calculus-{kind}-bank.json").read_text())
        for n, chapter in bank.items():
            path = target_path(args.dest, n, kind)
            label = "Chapter %s: %s" % (n, chapter.get("title", ""))
            title = f"{label} --- {'Practice Exercises' if kind == 'c' else 'Test'} {kind.upper()}{n}"
            doc = HEADER.format(kind=kind, n=n, graphics=GRAPHICS, title=title)
            doc += "\n".join(render_problem(p) for p in chapter["problems"])
            doc += "\n\n\\end{document}\n"
            path.write_text(doc)
            total += len(chapter["problems"])
            print(f"{path.name}: {len(chapter['problems'])} problems")
    print(f"{total} problems written")


if __name__ == "__main__":
    main()
