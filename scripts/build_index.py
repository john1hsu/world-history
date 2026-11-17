#!/usr/bin/env python3
"""Validate, then write index.json, which the reader site loads first."""
import json
import sys

from common import BOOKS_DIR, INDEX_JSON, load_books
import validate


def main():
    if validate.main(["--quiet"]) != 0:
        print("index.json not written: fix the errors above first")
        return 1
    out = {"books": []}
    for b in sorted(load_books(), key=lambda b: b["year"]):
        chapters = []
        for f in sorted((BOOKS_DIR / str(b["year"])).glob("*.json")):
            ch = json.loads(f.read_text())
            chapters.append({"n": ch["chapter"], "date": ch["date"], "verses": len(ch["verses"]),
                             "path": f"books/{b['year']}/{f.name}"})
        out["books"].append({"name": b["name"], "year": b["year"], "person": b["person"],
                             "lived": b["lived"], "chapters": chapters})
    INDEX_JSON.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    n = sum(len(b["chapters"]) for b in out["books"])
    print(f"index.json: {len(out['books'])} book(s), {n} chapter(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
