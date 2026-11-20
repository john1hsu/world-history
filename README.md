# World History

A history of the world, written one day at a time, beginning **16 November 2026**.

- **Books** are years, each named for a famous person who has died. Book one is *Longfellow*.
- **Chapters** are days, and **verses** are single sentences in dactylic hexameter, cited like
  scripture: *Longfellow 1:7*.
- A scheduled job writes yesterday's chapter every morning from sourced news reports and
  commits it here.

Read it on your phone: **https://john1hsu.github.io/world-history/**.
Swipe up for the next verse and down for the previous one. Swipe left for the next chapter and
right for the previous one. Tap a verse to see its plain-prose meaning and source, and tap the
reference at the top (*Longfellow 3:7*) to open the contents and jump to any chapter.
On a keyboard: ↑/↓ for verses, ←/→ for chapters, `c` for contents.

## Layout

| Path | What |
|---|---|
| `books.json` | the books: year, name, namesake |
| `books/<year>/<NNN>.json` | one chapter (day) with its verses, prose and sources |
| `index.json` | generated list of chapters that the site loads |
| `meter/lexicon.json` | stress patterns for names the dictionary lacks |
| `scripts/` | `next.py` (what to write), `scan.py` (meter check), `validate.py`, `build_index.py` |
| `index.html`, `assets/` | the reader |

How a chapter gets written is in [CLAUDE.md](CLAUDE.md).
