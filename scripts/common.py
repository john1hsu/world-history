"""Shared helpers for the world-history scripts."""
import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
BOOKS_JSON = ROOT / "books.json"
BOOKS_DIR = ROOT / "books"
INDEX_JSON = ROOT / "index.json"
TZ = ZoneInfo("America/New_York")

REGIONS = ["World", "Africa", "Americas", "Asia", "Europe", "Middle East", "Oceania"]
MIN_VERSES, MAX_VERSES = 20, 32
FIRST_DAY = dt.date(2026, 11, 16)  # the history begins here


def load_books():
    return json.loads(BOOKS_JSON.read_text())


def book_for_year(books, year):
    for b in books:
        if b["year"] == year:
            return b
    return None


def book_start(book):
    return dt.date.fromisoformat(book["start"])


def chapter_number(book, date):
    return (date - book_start(book)).days + 1


def chapter_path(year, chapter):
    return BOOKS_DIR / str(year) / f"{chapter:03d}.json"


def yesterday():
    return dt.datetime.now(TZ).date() - dt.timedelta(days=1)


def letters_in(name):
    return len(re.findall(r"[A-Za-z]", name))
