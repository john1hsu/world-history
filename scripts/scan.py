#!/usr/bin/env python3
"""Scan English lines as accentual dactylic hexameter.

The line must be six feet. Feet 1-4 are dactyls (/ x x) or trochees/spondees
(/ x); foot 5 must be a dactyl; foot 6 is two syllables (/ x). At least three
feet must be dactyls, so the line actually sounds dactylic.

Stress comes from the CMU Pronouncing Dictionary, with meter/lexicon.json taking
precedence (use it for names and words the dictionary lacks or gets wrong).

  Primary stress (1) in a word of 2+ syllables  -> must fall on a beat (/)
  Unstressed (0) in a word of 2+ syllables      -> must fall off the beat (x)
  Secondary stress (2)                          -> either
  Function-word monosyllables (the, of, and...) -> either
  Other monosyllables (nouns, verbs...)         -> a beat, or the first
                                                   syllable after a beat
                                                   (a spondee), never the
                                                   second off-beat of a dactyl

Usage:
  python3 scripts/scan.py "This is the forest primeval. The murmuring pines and the hemlocks,"
  python3 scripts/scan.py --file books/2026/001.json
"""
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXICON_PATH = ROOT / "meter" / "lexicon.json"

FUNCTION_WORDS = set("""
a an the and or but nor of to in on at by for from with as than that this these those
his her hers its their our my your he she it they we you i me him them us is are was were
be been am has had have do did does will would shall should can could may might must not no
so if when where while who whom whose which what there then up out off down through till yet
since once nor per via vs its ours theirs let such both each own same too very just
""".split())

BEAT, OFF1, OFF2 = "S", "w1", "w2"  # beat, first off-beat, second off-beat


@lru_cache(maxsize=1)
def _cmu():
    try:
        import cmudict
    except ImportError:
        sys.exit("cmudict is not installed: pip install -r requirements.txt --break-system-packages")
    return cmudict.dict()


@lru_cache(maxsize=1)
def _lexicon():
    if not LEXICON_PATH.exists():
        return {}
    raw = json.loads(LEXICON_PATH.read_text())
    out = {}
    for word, pats in raw.items():
        if word.startswith("_"):
            continue
        if isinstance(pats, str):
            pats = [pats]
        out[word.lower()] = pats
    return out


def tokenize(line):
    line = line.replace("’", "'").replace("‘", "'")
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)*", line)
    return words


def stress_patterns(word):
    """Return list of stress strings (e.g. ['10', '102']) or None if unknown."""
    w = word.lower()
    lex = _lexicon()
    if w in lex:
        return lex[w]
    d = _cmu()
    candidates = [w]
    if w.endswith("'s"):
        candidates.append(w[:-2])
    if w.endswith("s'"):
        candidates.append(w[:-1])
    for c in candidates:
        found = _lookup(c, lex, d)
        if found:
            return found
    # simple plural fallback: hemlocks -> hemlock, churches -> church + "es"
    if w.endswith("es") and re.search(r"(s|x|z|ch|sh)es$", w):
        base = _lookup(w[:-2], lex, d)
        if base:
            return [p + "0" for p in base]
    if w.endswith("s") and not w.endswith("ss"):
        base = _lookup(w[:-1], lex, d)
        if base:
            return base
    return None


def _lookup(c, lex, d):
    if c in lex:
        return lex[c]
    if c in d:
        pats = []
        for pron in d[c]:
            s = "".join(ch for ph in pron for ch in ph if ch.isdigit())
            if s and s not in pats:
                pats.append(s)
        return pats
    return None


def slot_options(word, pattern):
    """Allowed slots for each syllable of `word` under one stress pattern."""
    if len(pattern) == 1:
        if word.lower() in FUNCTION_WORDS or pattern == "0":
            return [{BEAT, OFF1, OFF2}]
        return [{BEAT, OFF1}]
    opts = []
    for s in pattern:
        if s == "1":
            opts.append({BEAT})
        elif s == "2":
            opts.append({BEAT, OFF1, OFF2})
        else:
            opts.append({OFF1, OFF2})
    return opts


def _step(state, allowed):
    """Advance a parser state by one syllable. Yields (new_state, mark)."""
    foot, pos, dactyls, fifth_ok = state
    if pos == "start":
        if BEAT in allowed:
            yield (0, BEAT, dactyls, fifth_ok), "/"
        return
    if pos == BEAT:
        if OFF1 in allowed:
            yield (foot, OFF1, dactyls, fifth_ok), "x"
        return
    if pos == OFF1:
        # second off-beat (makes a dactyl) - not allowed in the sixth foot
        if foot < 5 and OFF2 in allowed:
            yield (foot, OFF2, dactyls + 1, fifth_ok or foot == 4), "x"
        # or begin the next foot (this foot was two syllables)
        if foot < 5 and BEAT in allowed and foot != 4:
            yield (foot + 1, BEAT, dactyls, fifth_ok), "|/"
        return
    if pos == OFF2:
        if foot < 5 and BEAT in allowed:
            yield (foot + 1, BEAT, dactyls, fifth_ok), "|/"


def scan(line):
    """Return dict: ok, errors, scansion, syllables."""
    words = tokenize(line)
    result = {"ok": False, "errors": [], "scansion": None, "words": words}
    if re.search(r"\d", line):
        result["errors"].append("write numbers and dates in words, not digits")
    unknown = [w for w in words if stress_patterns(w) is None]
    if unknown:
        result["errors"].append(
            "unknown words (add them to meter/lexicon.json with a stress pattern, e.g. "
            '"zelensky": "010"): ' + ", ".join(sorted(set(unknown), key=str.lower))
        )
        return result
    if not words:
        result["errors"].append("empty line")
        return result

    # states: (foot, pos, dactyls, fifth_is_dactyl) -> marks string
    states = {(-1, "start", 0, False): ""}
    for word in words:
        new_states = {}
        for pattern in stress_patterns(word):
            opts = slot_options(word, pattern)
            frontier = dict(states)
            for allowed in opts:
                nxt = {}
                for st, marks in frontier.items():
                    for nst, mark in _step(st, allowed):
                        if nst not in nxt:
                            nxt[nst] = marks + mark
                frontier = nxt
            for st, marks in frontier.items():
                if st not in new_states:
                    new_states[st] = marks + " "
        states = new_states
        if not states:
            break

    finals = [(st, m) for st, m in states.items() if st[0] == 5 and st[1] == OFF1]
    good = [(st, m) for st, m in finals if st[3] and st[2] >= 3]
    if good:
        st, marks = max(good, key=lambda t: t[0][2])
        result["ok"] = True
        result["dactyls"] = st[2]
        result["scansion"] = _pretty(marks)
        return result

    nsyl = _syllable_range(words)
    if finals:
        st, marks = max(finals, key=lambda t: t[0][2])
        if not st[3]:
            result["errors"].append("the fifth foot must be a dactyl (/ x x), e.g. '...MUR-mur-ing PINES and the HEM-locks'")
        if st[2] < 3:
            result["errors"].append(f"only {st[2]} dactyls; use at least three so the line sounds dactylic")
        result["scansion"] = _pretty(marks)
    else:
        result["errors"].append(
            f"does not scan as hexameter ({nsyl[0]}-{nsyl[1]} syllables; a hexameter has 13-17). "
            "It must start on a stressed syllable, keep stressed syllables of long words on the beat, "
            "and end / x"
        )
    return result


def _syllable_range(words):
    lo = sum(min(len(p) for p in stress_patterns(w)) for w in words)
    hi = sum(max(len(p) for p in stress_patterns(w)) for w in words)
    return lo, hi


def _pretty(marks):
    """Turn the per-word marks into a foot pattern like '/xx|/xx|/x|/xx|/xx|/x'."""
    s = marks.replace(" ", "")
    return s


def main(argv):
    if len(argv) >= 2 and argv[0] == "--file":
        data = json.loads(Path(argv[1]).read_text())
        bad = 0
        for v in data["verses"]:
            r = scan(v["text"])
            flag = "ok " if r["ok"] else "BAD"
            bad += not r["ok"]
            print(f"{flag} {v['n']:>3}  {r['scansion'] or '-':<24} {v['text']}")
            for e in r["errors"]:
                print(f"           - {e}")
        return 1 if bad else 0
    lines = argv or [l for l in sys.stdin.read().splitlines() if l.strip()]
    bad = 0
    for line in lines:
        r = scan(line)
        bad += not r["ok"]
        print(("ok " if r["ok"] else "BAD") + f"  {r['scansion'] or '-'}  {line}")
        for e in r["errors"]:
            print(f"      - {e}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
