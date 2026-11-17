#!/usr/bin/env python3
"""Validate books.json and every chapter file. Exit 1 on any error.

  python3 scripts/validate.py            # everything
  python3 scripts/validate.py --quiet    # only print errors
"""
import datetime as dt
import json
import re
import sys
from urllib.parse import urlparse

from common import (BOOKS_DIR, FIRST_DAY, MAX_VERSES, MIN_VERSES, REGIONS,
                    book_start, chapter_number, chapter_path, letters_in,
                    load_books)
from scan import scan

SENTENCE_END = re.compile(r"[.!?][\"'”’)]*$")
INNER_END = re.compile(r"[.!?][\"'”’)]*\s+[\"'“‘(]*[A-Z]")


def check_books(books, errors):
    seen_names, seen_years = set(), set()
    for i, b in enumerate(books):
        where = f"books.json[{i}]"
        for key in ("year", "name", "person", "lived", "why", "start"):
            if not b.get(key):
                errors.append(f"{where}: missing '{key}'")
        name = b.get("name", "")
        if not re.fullmatch(r"[A-Za-z][A-Za-z' -]*[A-Za-z]", name or "x"):
            errors.append(f"{where}: name '{name}' must be a surname in letters")
        if letters_in(name) > 20:
            errors.append(f"{where}: name '{name}' is longer than twenty letters")
        if name.lower() in seen_names:
            errors.append(f"{where}: name '{name}' is already used by another book")
        seen_names.add(name.lower())
        if b.get("year") in seen_years:
            errors.append(f"{where}: two books for {b.get('year')}")
        seen_years.add(b.get("year"))
        if b.get("person") and name and name.lower() not in b["person"].lower():
            errors.append(f"{where}: '{name}' should be the last name of '{b['person']}'")
        try:
            start = dt.date.fromisoformat(b["start"])
            expected = FIRST_DAY if b["year"] == FIRST_DAY.year else dt.date(b["year"], 1, 1)
            if start != expected:
                errors.append(f"{where}: start should be {expected}")
        except (KeyError, ValueError):
            errors.append(f"{where}: start must be YYYY-MM-DD")


def check_sentence(text, where, errors):
    if not SENTENCE_END.search(text.strip()):
        errors.append(f"{where}: must end with . ! or ?")
    if INNER_END.search(text.strip()):
        errors.append(f"{where}: must be a single sentence (found a sentence break inside)")


def check_chapter(path, book, errors, scan_errors):
    where = str(path.relative_to(BOOKS_DIR.parent))
    try:
        ch = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"{where}: invalid JSON ({e})")
        return
    for key in ("book", "year", "chapter", "date", "verses"):
        if key not in ch:
            errors.append(f"{where}: missing '{key}'")
            return
    if ch["book"] != book["name"] or ch["year"] != book["year"]:
        errors.append(f"{where}: book/year should be {book['name']}/{book['year']}")
    try:
        date = dt.date.fromisoformat(ch["date"])
    except ValueError:
        errors.append(f"{where}: bad date")
        return
    if date.year != book["year"]:
        errors.append(f"{where}: date {date} is not in {book['year']}")
    n = chapter_number(book, date)
    if ch["chapter"] != n or path != chapter_path(book["year"], n):
        errors.append(f"{where}: {date} is chapter {n} (books/{book['year']}/{n:03d}.json)")
    verses = ch["verses"]
    if not (MIN_VERSES <= len(verses) <= MAX_VERSES):
        errors.append(f"{where}: has {len(verses)} verses; use {MIN_VERSES}-{MAX_VERSES}")
    texts = set()
    for i, v in enumerate(verses, 1):
        vw = f"{where} verse {i}"
        if v.get("n") != i:
            errors.append(f"{vw}: n should be {i}")
        text = (v.get("text") or "").strip()
        prose = (v.get("prose") or "").strip()
        if not text:
            errors.append(f"{vw}: missing text")
            continue
        if text.lower() in texts:
            errors.append(f"{vw}: duplicate verse")
        texts.add(text.lower())
        check_sentence(text, vw, errors)
        if not prose:
            errors.append(f"{vw}: missing prose (the plain factual sentence the verse is based on)")
        else:
            check_sentence(prose, vw + " prose", errors)
        if v.get("region") not in REGIONS:
            errors.append(f"{vw}: region must be one of {REGIONS}")
        srcs = v.get("sources") or []
        if not srcs:
            errors.append(f"{vw}: needs at least one source")
        for s in srcs:
            u = urlparse(s.get("url", ""))
            if u.scheme != "https" or not u.netloc:
                errors.append(f"{vw}: source url must be https ({s.get('url')})")
            if not s.get("title") or not s.get("publisher"):
                errors.append(f"{vw}: each source needs title and publisher")
        r = scan(text)
        if not r["ok"]:
            for e in r["errors"]:
                scan_errors.append(f"{vw}: {e}\n      {text}")


def main(argv):
    quiet = "--quiet" in argv
    errors, scan_errors = [], []
    books = load_books()
    check_books(books, errors)
    by_year = {b["year"]: b for b in books if "year" in b}

    for year_dir in sorted(p for p in BOOKS_DIR.iterdir() if p.is_dir()):
        year = int(year_dir.name)
        book = by_year.get(year)
        files = sorted(year_dir.glob("*.json"))
        if not book:
            if files:
                errors.append(f"books/{year}: no book for {year} in books.json")
            continue
        for f in files:
            check_chapter(f, book, errors, scan_errors)
        # chapters must be contiguous from 1
        nums = sorted(int(f.stem) for f in files if f.stem.isdigit())
        if nums and nums != list(range(1, nums[-1] + 1)):
            missing = sorted(set(range(1, nums[-1] + 1)) - set(nums))
            errors.append(f"books/{year}: missing chapters {missing}")

    for e in errors + scan_errors:
        print("ERROR", e)
    if errors or scan_errors:
        print(f"\n{len(errors) + len(scan_errors)} problem(s)")
        return 1
    if not quiet:
        total = sum(len(list((BOOKS_DIR / str(y)).glob('*.json'))) for y in by_year
                    if (BOOKS_DIR / str(y)).exists())
        print(f"OK: {len(books)} book(s), {total} chapter(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
