# Deterministically grades every "pending" submission in
# data/submissions-log.json against the matching T/C answer bank, and
# writes one structured report per submission — score, and for every
# miss, the full problem (stem/choices/explanation) pulled straight from
# the bank so a human (or Claude) can go write feedback text from it
# without re-deriving anything.
#
# This script only grades — it never touches submissions-log.json or
# js/data.js. Writing feedback/cheat-sheet entries, flipping a
# submission's status, and roadmap unlocks stay a separate, explicit
# step after a human reviews the report.
#
# Usage: python3 scripts/grade_pending.py [--course ap-calculus-bc]
#                                          [--chapter 3] [--unit C]
#                                          [--out report.json]
# With no filters, grades every pending submission across every
# course/chapter/unit that has a matching bank.

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# unit letter (first char of the submission's "unit" field) -> bank file
# stem, keyed by subject. "C6" style chapter-scoped unit fields (like the
# T-bank's T1..T10) still start with the letter we key off of here.
BANK_FILES = {
    "ap-calculus-bc": {"T": "calculus-t-bank.json", "C": "calculus-c-bank.json"},
    "ap-chemistry": {"T": "chemistry-t-bank.json", "C": "chemistry-c-bank.json"},
}

_bank_cache = {}


def load_bank(filename):
    if filename not in _bank_cache:
        path = DATA / filename
        with open(path, encoding="utf-8") as f:
            _bank_cache[filename] = json.load(f)
    return _bank_cache[filename]


ID_GROUP_RE = re.compile(r"^([A-Za-z]+)(\d+)$")


def id_groups(problem_ids):
    """Split an ordered id list into contiguous same-prefix groups,
    e.g. [T1..T34, TB1..TB6] -> [("T", [T1..T34]), ("TB", [TB1..TB6])].
    Group order follows first appearance, matching how both the T-bank
    (T/TB) and C-bank (A/B) submissions are laid out as separate blocks
    in the raw submitted text."""
    groups = []
    for pid in problem_ids:
        m = ID_GROUP_RE.match(pid)
        prefix = m.group(1) if m else pid
        if groups and groups[-1][0] == prefix:
            groups[-1][1].append(pid)
        else:
            groups.append((prefix, [pid]))
    return groups


NUMBERED_RE = re.compile(r"(\d+)\s*[.)]\s*([A-D])\b")


def split_blocks(raw_text):
    """Raw submitted text is one or more blocks separated by blank
    lines, one block per id-group (matches the T/TB or A/B split)."""
    blocks = [b.strip() for b in re.split(r"\n\s*\n", raw_text.strip()) if b.strip()]
    return blocks


def try_positional_parse(blocks, groups):
    """Case 1 (most submissions so far): each block is just a bare
    sequence of letters, one per problem, in problem order. Succeeds
    only if block count and each block's letter-count match the bank's
    id-groups exactly — otherwise we refuse to guess."""
    if len(blocks) != len(groups):
        return None
    answers = {}
    for block, (prefix, ids) in zip(blocks, groups):
        letters = re.sub(r"[^A-Da-d]", "", block)
        if len(letters) != len(ids):
            return None
        for pid, letter in zip(ids, letters.upper()):
            answers[pid] = letter
    return answers


def try_numbered_parse(blocks, groups):
    """Case 2: each block has explicit "N. LETTER" pairs, where N is
    the 1-based position of the problem *within that block's group*
    (not the literal id number — a block for a T/TB or A/B group always
    starts its own local numbering at 1 per the forms we've seen).
    A number missing from a block means that problem was left
    unanswered, not that it's wrong — recorded as None so grading can
    tell the difference."""
    if len(blocks) != len(groups):
        return None
    answers = {}
    for block, (prefix, ids) in zip(blocks, groups):
        pairs = NUMBERED_RE.findall(block)
        if not pairs:
            return None
        by_pos = {int(n): letter.upper() for n, letter in pairs}
        if max(by_pos) > len(ids):
            return None
        for i, pid in enumerate(ids, start=1):
            answers[pid] = by_pos.get(i)  # None = left blank
    return answers


def parse_answers(raw_text, groups):
    blocks = split_blocks(raw_text)
    parsed = try_positional_parse(blocks, groups)
    method = "positional"
    if parsed is None:
        parsed = try_numbered_parse(blocks, groups)
        method = "numbered"
    if parsed is None:
        return None, None
    return parsed, method


def grade_submission(sub):
    course_id = sub.get("courseId")
    unit = (sub.get("unit") or "").strip()
    chapter_str = re.sub(r"[^\d]", "", sub.get("chapter", ""))
    unit_key = unit[0].upper() if unit else ""

    result = {
        "id": sub["id"],
        "username": sub.get("username"),
        "courseId": course_id,
        "chapter": sub.get("chapter"),
        "unit": unit,
    }

    subject_banks = BANK_FILES.get(course_id)
    if not subject_banks or unit_key not in subject_banks:
        result["status"] = "NOT_AUTOGRADABLE"
        result["reason"] = f"no bank mapping for course={course_id!r} unit={unit!r}"
        return result

    bank_file = subject_banks[unit_key]
    bank = load_bank(bank_file)
    chapter = bank.get(chapter_str)
    if not chapter or not chapter.get("problems"):
        result["status"] = "NEEDS_BANK"
        result["reason"] = f"{bank_file} has no data for chapter {chapter_str!r} (placeholder or not yet built)"
        return result

    problems = {p["id"]: p for p in chapter["problems"]}
    ordered_ids = [p["id"] for p in chapter["problems"]]
    groups = id_groups(ordered_ids)

    raw_text = (sub.get("answers") or {}).get("Upload the relevant answers here", "")
    parsed, method = parse_answers(raw_text, groups)
    if parsed is None:
        result["status"] = "NEEDS_REVIEW"
        result["reason"] = "couldn't parse raw answer text against expected id-groups " \
                            f"{[(p, len(ids)) for p, ids in groups]} — format not recognized"
        result["raw_answers"] = raw_text
        return result

    misses = []
    unanswered = []
    correct_count = 0
    for pid in ordered_ids:
        given = parsed.get(pid)
        correct = problems[pid]["correct"]
        if given is None:
            unanswered.append(pid)
        elif given == correct:
            correct_count += 1
        else:
            p = problems[pid]
            misses.append({
                "id": pid,
                "given": given,
                "correct": correct,
                "stem": p.get("stem") or p.get("stem_tex"),
                "choices": p.get("choices") or p.get("choices_tex"),
                "explanation": p.get("explanation") or p.get("explanation_tex"),
            })

    result["status"] = "GRADED"
    result["parse_method"] = method
    result["total"] = len(ordered_ids)
    result["correct_count"] = correct_count
    result["unanswered"] = unanswered
    result["misses"] = misses
    result["remarks"] = (sub.get("answers") or {}).get("feedback-and-remarks", "")
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course")
    ap.add_argument("--chapter")
    ap.add_argument("--unit")
    ap.add_argument("--out")
    args = ap.parse_args()

    with open(DATA / "submissions-log.json", encoding="utf-8") as f:
        submissions = json.load(f)

    pending = [s for s in submissions if s.get("status") == "pending"]
    if args.course:
        pending = [s for s in pending if s.get("courseId") == args.course]
    if args.chapter:
        pending = [s for s in pending if re.sub(r"[^\d]", "", s.get("chapter", "")) == args.chapter]
    if args.unit:
        pending = [s for s in pending if (s.get("unit") or "").upper().startswith(args.unit.upper())]

    reports = [grade_submission(s) for s in pending]

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)

    counts = {}
    for r in reports:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    print(f"{len(reports)} pending submission(s) processed: {counts}\n")
    for r in reports:
        header = f"[{r['status']}] {r['username']} — {r['courseId']} {r['chapter']} {r['unit']} ({r['id']})"
        print(header)
        if r["status"] == "GRADED":
            print(f"  score: {r['correct_count']}/{r['total']}  "
                  f"misses: {[m['id'] for m in r['misses']]}  "
                  f"unanswered: {r['unanswered']}  parsed via: {r['parse_method']}")
        elif r["status"] in ("NEEDS_REVIEW", "NEEDS_BANK", "NOT_AUTOGRADABLE"):
            print(f"  reason: {r['reason']}")
        print()


if __name__ == "__main__":
    main()
