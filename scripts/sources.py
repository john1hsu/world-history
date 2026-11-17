#!/usr/bin/env python3
"""Report how widely a chapter's sources are spread across publishers.

  python3 scripts/sources.py --file books/2026/002.json

Prints each publisher with the number of verses that cite it, then a warning if
one publisher is cited by more than a third of the verses or the chapter cites
fewer than eight publishers. Warnings never fail the run; they mean "go and find
other outlets for some of these verses before you publish".
"""
import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

MAX_SHARE = 1 / 3
MIN_PUBLISHERS = 8


def report(path):
    ch = json.loads(Path(path).read_text())
    verses = ch["verses"]
    by_pub = Counter()
    for v in verses:
        pubs = {(s.get("publisher") or urlparse(s.get("url", "")).netloc).strip()
                for s in v.get("sources", [])}
        by_pub.update(pubs)

    n = len(verses)
    print(f"{path}: {n} verses, {len(by_pub)} publishers")
    for pub, k in by_pub.most_common():
        print(f"  {k:>3}  {pub}")

    warnings = []
    for pub, k in by_pub.most_common():
        if n and k / n > MAX_SHARE:
            warnings.append(f"{pub} is cited in {k} of {n} verses; keep any one publisher "
                            f"to {int(n * MAX_SHARE)} or fewer")
    if len(by_pub) < MIN_PUBLISHERS:
        warnings.append(f"only {len(by_pub)} publishers; aim for at least {MIN_PUBLISHERS}")
    for w in warnings:
        print("WARN", w)
    if not warnings:
        print("Source spread OK")


def main(argv):
    if len(argv) != 2 or argv[0] != "--file":
        sys.exit(__doc__)
    report(argv[1])


if __name__ == "__main__":
    main(sys.argv[1:])
