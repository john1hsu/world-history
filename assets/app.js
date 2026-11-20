/* World History reader: one verse per full-screen page.
   Swipe up for the next verse, down for the previous one.
   Swipe left for the next chapter, right for the previous one.
   Tap a verse to see the plain-prose meaning and its source.
   Tap the reference at the top (e.g. "Longfellow 3:7") to open the contents.
   Keys and the mouse wheel also work. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var POS_KEY = "world-history:pos";

  var books = [];      // {name, year, person, lived, first, last} (chapter indexes)
  var chapters = [];   // flattened {book, year, n, date, verses, path, offset}
  var total = 0;       // total verses; position `total` is the closing page
  var pos = 0;
  var pages = {};      // -1, 0, 1 -> element
  var busy = false;
  var cache = {};

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function loadChapter(path) {
    if (!cache[path]) {
      cache[path] = fetch(path, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }

  function locate(g) {
    var lo = 0, hi = chapters.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (chapters[mid].offset <= g) lo = mid; else hi = mid - 1;
    }
    var c = chapters[lo];
    return { chapter: c, index: lo, verse: g - c.offset + 1 };
  }

  function refString(g) {
    var l = locate(g);
    return l.chapter.book + "/" + l.chapter.n + "/" + l.verse;
  }

  function parseRef(s) {
    var m = /^#?([A-Za-z' -]+)\/(\d+)\/(\d+)$/.exec(decodeURIComponent(s || ""));
    if (!m) return -1;
    for (var i = 0; i < chapters.length; i++) {
      var c = chapters[i];
      if (c.book.toLowerCase() === m[1].toLowerCase() && c.n === +m[2]) {
        var v = Math.min(Math.max(+m[3], 1), c.verses);
        return c.offset + v - 1;
      }
    }
    return -1;
  }

  function longDate(iso, noYear) {
    var opts = { weekday: "long", month: "long", day: "numeric" };
    if (!noYear) opts.year = "numeric";
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", opts);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function makePage(g) {
    var page = el("section", "page");
    var ref = el("div", "ref");
    var body = el("div", "body");
    var verse = el("p", "verse");
    var gloss = el("div", "gloss");
    var foot = el("div", "foot");
    body.appendChild(verse);
    body.appendChild(gloss);
    page.appendChild(ref);
    page.appendChild(body);
    page.appendChild(foot);

    if (total === 0 || g >= total) {
      page.classList.add("end");
      verse.textContent = total === 0
        ? "The first chapter of this history is written at dawn."
        : "The next chapter of this history is written at dawn.";
      return page;
    }

    var l = locate(g);
    var c = l.chapter;
    ref.textContent = c.book + " " + c.n + ":" + l.verse;
    ref.setAttribute("role", "button");
    ref.setAttribute("aria-label", c.book + " chapter " + c.n + ", verse " + l.verse + ". Open contents");
    foot.textContent = longDate(c.date);
    page.classList.add("loading");
    verse.textContent = " ";

    loadChapter(c.path).then(function (data) {
      var v = data.verses[l.verse - 1];
      page.classList.remove("loading");
      if (!v) { verse.textContent = "This verse could not be found."; return; }
      verse.textContent = v.text;
      foot.innerHTML = "";
      foot.appendChild(document.createTextNode(longDate(c.date)));
      if (v.region) {
        foot.appendChild(el("span", "sep", "  ·  "));
        foot.appendChild(el("span", "region", v.region));
      }
      var p = el("p", null, v.prose || "");
      p.style.margin = "0 0 .6rem";
      gloss.appendChild(p);
      var srcs = el("div");
      (v.sources || []).forEach(function (s, i) {
        if (i) srcs.appendChild(document.createTextNode(" · "));
        var a = el("a", null, s.publisher || s.title);
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.title = s.title || "";
        srcs.appendChild(a);
      });
      gloss.appendChild(srcs);
    }).catch(function () {
      page.classList.remove("loading");
      verse.textContent = "This page could not be loaded. Check your connection.";
    });
    return page;
  }

  function height() { return window.innerHeight; }
  function width() { return window.innerWidth; }

  function place(offset, animate) {
    var h = height();
    [-1, 0, 1].forEach(function (k) {
      var p = pages[k];
      if (!p) return;
      p.classList.toggle("animate", !!animate);
      p.style.transform = "translate3d(0," + (k * h + offset) + "px,0)";
    });
  }

  function exists(g) { return g >= 0 && g <= total && !(total === 0 && g > 0); }

  // Rebuild the three pages around `pos`. `center` reuses an already-made page.
  function build(center) {
    stage.innerHTML = "";
    pages = {};
    [-1, 0, 1].forEach(function (k) {
      if (exists(pos + k)) {
        pages[k] = (k === 0 && center) ? center : makePage(pos + k);
        stage.appendChild(pages[k]);
      }
    });
    place(0, false);
  }

  function remember() {
    if (pos >= total) return;
    var ref = refString(pos);
    store(POS_KEY, ref);
    if (history.replaceState) history.replaceState(null, "", "#" + ref);
  }

  // Next or previous verse (vertical).
  function go(dir) {
    if (busy || !pages[dir]) { place(0, true); return; }
    busy = true;
    if (pages[0]) pages[0].classList.remove("open");
    place(-dir * height(), true);
    setTimeout(function () {
      var gone = pages[-dir];
      if (gone) stage.removeChild(gone);
      pages[-dir] = pages[0];
      pages[0] = pages[dir];
      pos += dir;
      pages[dir] = null;
      if (exists(pos + dir)) {
        pages[dir] = makePage(pos + dir);
        stage.appendChild(pages[dir]);
      }
      place(0, false);
      remember();
      busy = false;
    }, 330);
  }

  // First verse of the next (dir 1) or previous (dir -1) chapter, or -1.
  // Past the last chapter is the closing page; before the first is nothing.
  function chapterTarget(dir) {
    if (total === 0) return -1;
    var i = pos >= total ? chapters.length : locate(pos).index;
    var j = i + dir;
    if (j < 0) return -1;
    if (j >= chapters.length) return pos >= total ? -1 : total;
    return chapters[j].offset;
  }

  // Slide sideways to position g. dir 1 slides in from the right.
  function jumpTo(g, dir) {
    if (busy || g < 0 || !exists(g)) { place(0, true); return; }
    if (g === pos) { place(0, true); return; }
    busy = true;
    var w = width();
    var incoming = makePage(g);
    incoming.style.transform = "translate3d(" + (dir * w) + "px,0,0)";
    stage.appendChild(incoming);
    incoming.getBoundingClientRect(); // commit the start position before animating
    incoming.classList.add("animate");
    incoming.style.transform = "translate3d(0,0,0)";
    if (pages[0]) {
      pages[0].classList.remove("open");
      pages[0].classList.add("animate");
      pages[0].style.transform = "translate3d(" + (-dir * w) + "px,0,0)";
    }
    setTimeout(function () {
      pos = g;
      build(incoming);
      remember();
      busy = false;
    }, 330);
  }

  function chapter(dir) {
    var g = chapterTarget(dir);
    if (g < 0) { nudge(dir); return; }
    jumpTo(g, dir);
  }

  // A small bounce when there is no chapter in that direction.
  function nudge(dir) {
    if (busy || !pages[0]) return;
    var p = pages[0];
    p.classList.add("animate");
    p.style.transform = "translate3d(" + (-dir * 24) + "px,0,0)";
    setTimeout(function () { place(0, true); }, 140);
  }

  // --- contents ---------------------------------------------------------------
  var toc = el("div", "toc");
  toc.hidden = true;
  var tocBackdrop = el("div", "toc-backdrop");
  var tocSheet = el("nav", "toc-sheet");
  tocSheet.setAttribute("aria-label", "Contents");
  var tocList = el("div", "toc-list");
  tocSheet.appendChild(el("div", "toc-grip"));
  tocSheet.appendChild(el("h2", "toc-title", "Contents"));
  tocSheet.appendChild(tocList);
  tocSheet.appendChild(el("p", "toc-hint", "Swipe left or right on a verse to change chapters."));
  toc.appendChild(tocBackdrop);
  toc.appendChild(tocSheet);
  document.body.appendChild(toc);

  function tocOpen() { return !toc.hidden; }

  function renderContents() {
    tocList.innerHTML = "";
    var current = pos < total ? locate(pos).index : -1;
    var currentLink = null;
    books.forEach(function (b) {
      var sec = el("section", "toc-book");
      var h = el("h3", null, b.name);
      h.appendChild(el("span", "toc-year", String(b.year)));
      sec.appendChild(h);
      if (b.person) {
        sec.appendChild(el("p", "toc-namesake", b.person + (b.lived ? ", " + b.lived : "")));
      }
      var ol = el("ol");
      for (var i = b.first; i <= b.last; i++) {
        var c = chapters[i];
        var li = el("li");
        var a = el("a");
        a.href = "#" + c.book + "/" + c.n + "/1";
        a.setAttribute("data-g", c.offset);
        a.appendChild(el("span", "toc-n", String(c.n)));
        a.appendChild(el("span", "toc-date", longDate(c.date, true)));
        a.appendChild(el("span", "toc-count", c.verses + " verses"));
        if (i === current) { a.classList.add("current"); a.setAttribute("aria-current", "true"); currentLink = a; }
        li.appendChild(a);
        ol.appendChild(li);
      }
      sec.appendChild(ol);
      tocList.appendChild(sec);
    });
    return currentLink;
  }

  function openContents() {
    if (busy || chapters.length === 0 || tocOpen()) return;
    if (pages[0]) pages[0].classList.remove("open");
    var current = renderContents();
    toc.hidden = false;
    if (current) current.scrollIntoView({ block: "center" });
    toc.getBoundingClientRect();
    toc.classList.add("open");
  }

  function closeContents() {
    if (!tocOpen()) return;
    toc.classList.remove("open");
    setTimeout(function () { toc.hidden = true; }, 260);
  }

  tocBackdrop.addEventListener("click", closeContents);
  tocList.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-g]");
    if (!a) return;
    e.preventDefault();
    var g = +a.getAttribute("data-g");
    closeContents();
    if (g !== pos) jumpTo(g, g > pos ? 1 : -1);
  });

  // --- gestures -----------------------------------------------------------
  var startX = null, startY = null, startT = 0, dx = 0, dy = 0;
  var axis = null, downTarget = null;

  stage.addEventListener("pointerdown", function (e) {
    if (busy) return;
    startX = e.clientX;
    startY = e.clientY;
    startT = performance.now();
    dx = dy = 0;
    axis = null;
    downTarget = e.target;
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });

  stage.addEventListener("pointermove", function (e) {
    if (startY === null || busy) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis === "y") {
      var d = dy;
      if ((d < 0 && !pages[1]) || (d > 0 && !pages[-1])) d *= 0.28;
      place(d, false);
    } else if (axis === "x" && pages[0]) {
      var x = dx;
      if (chapterTarget(x < 0 ? 1 : -1) < 0) x *= 0.28;
      pages[0].classList.remove("animate");
      pages[0].style.transform = "translate3d(" + x + "px,0,0)";
    }
  });

  function end() {
    if (startY === null) return;
    var dt = Math.max(performance.now() - startT, 1);
    startY = null;
    if (!axis) {
      var t = downTarget;
      if (t && t.closest && t.closest(".ref") && pages[0] && !pages[0].classList.contains("end")) {
        openContents();
        return;
      }
      var link = t && t.closest && t.closest("a");
      if (link && pages[0] && pages[0].classList.contains("open")) return;
      if (pages[0] && !pages[0].classList.contains("end")) pages[0].classList.toggle("open");
      return;
    }
    if (axis === "x") {
      var vx = dx / dt, w = width();
      if ((dx < -w * 0.18 || vx < -0.45) && chapterTarget(1) >= 0) jumpTo(chapterTarget(1), 1);
      else if ((dx > w * 0.18 || vx > 0.45) && chapterTarget(-1) >= 0) jumpTo(chapterTarget(-1), -1);
      else place(0, true);
      return;
    }
    var v = dy / dt;
    var h = height();
    if ((dy < -h * 0.16 || v < -0.45) && pages[1]) go(1);
    else if ((dy > h * 0.16 || v > 0.45) && pages[-1]) go(-1);
    else place(0, true);
  }
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", function () { startY = null; place(0, true); });

  // Links in the gloss open even though the stage captures the pointer.
  stage.addEventListener("click", function (e) {
    var link = downTarget && downTarget.closest && downTarget.closest(".gloss a");
    if (link && e.target !== link && pages[0] && pages[0].classList.contains("open")) {
      window.open(link.href, "_blank", "noopener");
    }
  });

  var wheelY = 0, wheelX = 0, wheelTimer = null;
  window.addEventListener("wheel", function (e) {
    if (tocOpen()) return; // let the contents scroll
    e.preventDefault();
    if (busy) return;
    wheelY += e.deltaY;
    wheelX += e.deltaX;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelY = wheelX = 0; }, 160);
    if (Math.abs(wheelX) > Math.abs(wheelY)) {
      if (wheelX > 80) { wheelX = wheelY = 0; chapter(1); }
      else if (wheelX < -80) { wheelX = wheelY = 0; chapter(-1); }
    } else if (wheelY > 40) { wheelX = wheelY = 0; go(1); }
    else if (wheelY < -40) { wheelX = wheelY = 0; go(-1); }
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (tocOpen()) {
      if (e.key === "Escape" || e.key === "c") { e.preventDefault(); closeContents(); }
      return;
    }
    if (["ArrowDown", "PageDown", " ", "j"].indexOf(e.key) >= 0) { e.preventDefault(); go(1); }
    else if (["ArrowUp", "PageUp", "k"].indexOf(e.key) >= 0) { e.preventDefault(); go(-1); }
    else if (["ArrowRight", "l"].indexOf(e.key) >= 0) { e.preventDefault(); chapter(1); }
    else if (["ArrowLeft", "h"].indexOf(e.key) >= 0) { e.preventDefault(); chapter(-1); }
    else if (e.key === "c") { e.preventDefault(); openContents(); }
    else if (e.key === "Enter" && pages[0]) pages[0].classList.toggle("open");
  });

  window.addEventListener("resize", function () { place(0, false); });

  window.addEventListener("hashchange", function () {
    var g = parseRef(location.hash);
    if (g >= 0 && g !== pos) { pos = g; build(); remember(); }
  });

  // --- start ----------------------------------------------------------------
  fetch("index.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (index) {
      index.books.forEach(function (b) {
        var first = chapters.length;
        b.chapters.forEach(function (c) {
          chapters.push({ book: b.name, year: b.year, n: c.n, date: c.date,
                          verses: c.verses, path: c.path, offset: total });
          total += c.verses;
        });
        if (chapters.length > first) {
          books.push({ name: b.name, year: b.year, person: b.person, lived: b.lived,
                       first: first, last: chapters.length - 1 });
        }
      });
      var g = parseRef(location.hash);
      if (g < 0) g = parseRef(store(POS_KEY));
      pos = g >= 0 ? g : 0;
      build();
      remember();
    })
    .catch(function () {
      stage.innerHTML = "";
      var p = makePage(0);
      p.querySelector(".verse").textContent = "The history could not be loaded. Check your connection.";
      stage.appendChild(p);
    });
})();
