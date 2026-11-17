# World History: instructions for the daily writer

This repo is a history of the world, written one day at a time from **16 November 2026**.
Each run writes yesterday's chapter (US Eastern time) and commits it **directly to `main`**
(no branches, issues or PRs).

## Shape of the history

- **Books** are calendar years. Each book is named after the **last name of a famous person
  who has died**, at most **20 letters**, never reused. Names live in `books.json`.
  Book one (2026) is **Longfellow**. It starts on 2026-11-16, and every later book starts on 1 January.
- **Chapters** are days. A chapter's number is its day within the book, so Longfellow 1 is
  16 November 2026 and the 2027 book's chapter 1 is 1 January 2027. The file goes in
  `books/<year>/<chapter as 3 digits>.json`.
- **Verses** are numbered sentences, cited like Bible verses ("Longfellow 1:7"). A chapter
  has **20-32 verses (aim for 26)**. Every verse is **exactly one sentence**, written as
  **one line of dactylic hexameter**.

## Chapter file format

```json
{
  "book": "Longfellow",
  "year": 2026,
  "chapter": 1,
  "date": "2026-11-16",
  "verses": [
    {
      "n": 1,
      "text": "The hexameter line, one sentence.",
      "prose": "The plain factual sentence the verse is based on, with names, numbers and attribution.",
      "region": "Europe",
      "sources": [
        {"title": "Headline of the article", "publisher": "Reuters", "url": "https://..."}
      ]
    }
  ]
}
```

`region` is one of: World, Africa, Americas, Asia, Europe, Middle East, Oceania.
The site shows `text` on the page. Tapping the page shows `prose` and the source links.

## The daily run

1. `pip install -r requirements.txt --break-system-packages -q`, then `python3 scripts/next.py`.
   It lists the chapters still missing up to yesterday, oldest first, and any year that has no
   book yet. Write **every missing chapter in order, at most 3 per run** (normally just one).
2. **New year:** if `needs_new_book` lists a year, add that year's book to `books.json` before
   you write its first chapter: `{"year", "name", "person", "lived", "why", "start": "YYYY-01-01"}`.
   - The name is the person's last name (≤20 letters) and is not used by any earlier book.
   - Pick a person who is widely known and **died at least 25 years ago**: a historian, poet,
     explorer, scientist, artist, composer, reformer or statesman of lasting renown.
     Avoid anyone divisive today, and anyone whose surname is also a common word
     (Bell, Wood, Hope) or a living public figure's name.
   - Write `why` as one sentence on why the name suits a year of history.
3. **Research the day.** Use WebSearch and WebFetch to find what happened **on that date**:
   world politics and diplomacy, conflicts and peace efforts, economies and markets, science,
   health, space and technology, climate and disasters, culture and sport, and notable deaths.
   Cover **every inhabited region**, not only the United States and Europe. Prefer wire
   services and public broadcasters (Reuters, AP, AFP, BBC, NPR, Al Jazeera, DW, NHK, ABC
   Australia, CBC), official sources (governments, the UN, WHO, NASA, central banks) and
   reputable newspapers. **Open every article you cite during this run.** Never cite from memory,
   never invent a URL, and never use Wikipedia, aggregators, content farms or social posts.
   An event belongs to the day it happened or was announced. Things that were only expected
   that day go in as expectations ("ministers were due to...").
4. **Choose about 26 events** and put the chapter in order: the day's most consequential
   story first, then a journey around the world, then science, culture and sport, then
   notable deaths. Give one event one verse. Two verses for an event are fine only when it
   truly dominated the day.
5. **Write each verse.** Write the `prose` first, as one accurate, neutral sentence that
   attributes claims and casualty figures to their source ("at least 12 people died, officials
   said"). Then render it as a hexameter `text` that keeps the facts of the prose.
   **Accuracy beats meter.** Never change a fact, number, name, place or attribution to make a
   line scan. Rephrase until it scans, or choose a different event.
6. **Check:** `python3 scripts/scan.py --file books/<year>/<NNN>.json` shows each verse's scansion.
   Fix every BAD line. Then `python3 scripts/validate.py` must print `OK`.
7. **Publish:** `python3 scripts/build_index.py` (it re-validates and writes `index.json`).
   Then commit everything (the chapter, `index.json`, and any `books.json` or
   `meter/lexicon.json` changes) with the message
   `Longfellow 1: November 16, 2026` (book, chapter, date), and push to `main`.
   If the push is rejected, `git pull --rebase origin main`, rebuild the index, and push once more.

## Writing dactylic hexameter in English

The checker (`scripts/scan.py`) uses stress, not syllable length. A line is **six feet**:

- Feet 1-4 are each a **dactyl** (`/ x x`, "MUR-mur-ing") or a **trochee/spondee** (`/ x`,
  "HEM-locks").
- **Foot 5 must be a dactyl.**
- Foot 6 is two syllables, `/ x`.
- At least three feet are dactyls. A line runs 13-17 syllables, **starts on a stressed
  syllable** and **ends on an unstressed one**.

Stressed syllables of long words must land on the beat (`/`) and unstressed ones off it (`x`).
Small words (the, of, and, in, to, a) can go anywhere. Other one-syllable words can take the
beat or the slot just after it.

Examples that pass (`|` marks the feet):

```
This is the | forest pri- | meval, the | murmuring | pines and the | hemlocks.
/  x   x  |  /   x   x |  / x    x  |  /  x  x   |  /    x   x  |  /   x
Snow fell | early in | Moscow, and | schools closed | down for the | morning.
Rain fell on | Paris and | Lisbon and | Rome through the | whole of the | morning.
```

Craft tips:
- Build lines from dactylic words and phrases: *presidents, ministers, parliament,
  hurricane, scientists, Africa, thousands of, over the, gathered in, voted to,
  signalled a*.
- The **ending is the most rigid part**. Close with `/ x x | / x`: "...gathered in | Brussels",
  "...over the | border", "...late in the | evening", "...over the | weekend".
- Spell out **all numbers and dates** in words ("eleven", "twenty", "two thousand"). Digits fail
  the check.
- Avoid abbreviations. Write "United Nations", not "UN". A full stop inside the line counts as a
  second sentence.
- Iambic openers ("Again the...", "Today...") fail because the line must start on a stress.
  Lead with the stressed subject instead.
- If the checker says a word is unknown (usually a name), add its stress pattern to
  `meter/lexicon.json`, e.g. `"zelenskyy": "010"`, `"guterres": "010"`. Use one digit per
  syllable as the name is actually pronounced. Never mark a stress wrongly to force a pass.
- Keep the voice measured, like a chronicle or the King James cadence. The aim is **grave,
  plain and clear**, not florid. No rhyme, no jokes, and no editorializing.

## Hard rules

- Neutral and fair: describe what happened and who said what. Take no side in politics or
  conflicts, and use no loaded labels except in attributed quotes.
- No graphic detail about violence. Give the event, the toll as reported, and who reported it.
- Never name private individuals (victims, suspects or bystanders) unless they are already
  public figures. Never say who is to blame for a crime before a court has ruled.
- Don't quote a source for more than 15 words, and write the `prose` in your own words.
- Every verse has at least one source opened this run, and every fact in the verse appears in
  its sources.
- Commit straight to `main`. Never rewrite pushed history, never edit an earlier chapter except
  to correct a factual error (say so in the commit message), and never commit a failing
  validation.
- End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.
