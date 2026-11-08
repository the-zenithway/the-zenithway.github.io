"""Merge source-reviewed LaTeX records without losing them on regeneration.

Run from any directory. Only explicitly reviewed IDs are replaced; untouched
records retain their original contents and are never labeled as verified.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWED = ROOT / "data/calculus-reviewed"


def browser_tex(value):
    """Strip prose-only document markup; preserve math commands and row breaks."""
    value = re.sub(r"\\(?:emph|textbf|textit)\{([^{}]*)\}", r"\1", value)
    return value.replace(r"\c{c}", "ç")


def apply_reviewed(bank, kind):
    for path in sorted(REVIEWED.glob(f"{kind}-*.json")):
        chapter = path.stem.split("-")[1]
        entries = json.loads(path.read_text())
        ids = [p["id"] for p in entries]
        assert len(ids) == len(set(ids)), f"Duplicate IDs in {path}"
        target = bank[chapter]
        existing = {p["id"] for p in target["problems"]}
        assert set(ids) <= existing, f"Unknown IDs in {path}"
        patches = {}
        for original in entries:
            p = dict(original)
            for field in ("stem_tex", "explanation_tex"):
                if field in p:
                    p[field] = browser_tex(p[field])
            assert p.get("stem_tex") and p.get("explanation_tex"), (path, p["id"])
            if target.get("type") != "frq":
                choices = p.get("choices_tex", [])
                assert len(choices) == 4 and all(choices), (path, p["id"])
                if p.get("source_issue"):
                    assert p.get("correct") is None, (path, p["id"])
                    target.setdefault("answer_key", {}).pop(p["id"], None)
                else:
                    assert p.get("correct") in ("A", "B", "C", "D"), (path, p["id"])
                    target.setdefault("answer_key", {})[p["id"]] = p["correct"]
            p["review_status"] = "source-reviewed"
            patches[p["id"]] = p
        target["problems"] = [patches.get(p["id"], p) for p in target["problems"]]
    return bank


def main():
    report = {"scope": "AP Calculus BC", "chapters": []}
    for kind in ("c", "t"):
        path = ROOT / f"data/calculus-{kind}-bank.json"
        bank = apply_reviewed(json.loads(path.read_text()), kind)
        path.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n")
        for chapter, group in bank.items():
            pending = [p["id"] for p in group["problems"]
                       if p.get("review_status") != "source-reviewed"]
            report["chapters"].append({"kind": kind.upper(), "chapter": chapter,
                "total": len(group["problems"]),
                "reviewed": len(group["problems"]) - len(pending),
                "pending_ids": pending,
                "repaired_source_ids": [p["id"] for p in group["problems"] if p.get("resolved_source_issue")],
                "source_issues": [{"id": p["id"], "reason": p["source_issue"]}
                    for p in group["problems"] if p.get("source_issue")]})
    report["total"] = sum(c["total"] for c in report["chapters"])
    report["reviewed"] = sum(c["reviewed"] for c in report["chapters"])
    report["repaired_source_count"] = sum(len(c["repaired_source_ids"]) for c in report["chapters"])
    report["source_issue_count"] = sum(len(c["source_issues"]) for c in report["chapters"])
    report["complete"] = report["reviewed"] == report["total"]
    (ROOT / "data/calculus-review-status.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"Reviewed {report['reviewed']} / {report['total']} problems")


if __name__ == "__main__":
    main()
