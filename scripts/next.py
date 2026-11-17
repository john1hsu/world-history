#!/usr/bin/env python3
"""Print the chapters still to be written, oldest first, up to yesterday (US Eastern).

Output (JSON): {"yesterday": ..., "todo": [{"date", "year", "book", "chapter", "path"}],
                "needs_new_book": [years without a book in books.json]}
"""
import datetime as dt
import json
import sys

from common import (FIRST_DAY, book_for_year, chapter_number, chapter_path,
                    load_books, yesterday)


def main():
    books = load_books()
    end = yesterday()
    todo, missing_books = [], []
    day = FIRST_DAY
    while day <= end:
        book = book_for_year(books, day.year)
        if book is None:
            if day.year not in missing_books:
                missing_books.append(day.year)
        else:
            n = chapter_number(book, day)
            path = chapter_path(day.year, n)
            if not path.exists():
                todo.append({"date": day.isoformat(), "year": day.year, "book": book["name"],
                             "chapter": n, "path": str(path.relative_to(path.parents[2]))})
        day += dt.timedelta(days=1)
    print(json.dumps({"yesterday": end.isoformat(), "todo": todo,
                      "needs_new_book": missing_books}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
