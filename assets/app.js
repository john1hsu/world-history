/* World History reader: one verse per full-screen page.
   Swipe up for the next verse, down for the previous one. Tap a verse to see
   the plain-prose meaning and its source. Keys and the mouse wheel also work. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var hint = document.getElementById("hint");
  var POS_KEY = "world-history:pos";
  var SWIPED_KEY = "world-history:swiped";

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
    return { chapter: c, verse: g - c.offset + 1 };
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

  function longDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
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
    ref.innerHTML = "";
    ref.appendChild(document.createTextNode(c.book + " " + c.n + ":" + l.verse));
    foot.textContent = longDate(c.date);
    page.classList.add("loading");
    verse.textContent = " ";

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

  function build() {
    stage.innerHTML = "";
    pages = {};
    [-1, 0, 1].forEach(function (k) {
      if (exists(pos + k)) {
        pages[k] = makePage(pos + k);
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

  function go(dir) {
    if (busy || !pages[dir]) { place(0, true); return; }
    busy = true;
    if (pages[0]) pages[0].classList.remove("open");
    place(-dir * height(), true);
    if (hint && !hint.hidden) {
      hint.classList.add("gone");
      store(SWIPED_KEY, "1");
    }
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

  // --- gestures -----------------------------------------------------------
  var startY = null, startT = 0, dy = 0, moved = false;

  stage.addEventListener("pointerdown", function (e) {
    if (busy) return;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    moved = false;
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });

  stage.addEventListener("pointermove", function (e) {
    if (startY === null || busy) return;
    dy = e.clientY - startY;
    if (Math.abs(dy) > 6) moved = true;
    var d = dy;
    if ((d < 0 && !pages[1]) || (d > 0 && !pages[-1])) d *= 0.28;
    place(d, false);
  });

  function end(e) {
    if (startY === null) return;
    var dt = Math.max(performance.now() - startT, 1);
    var v = dy / dt;
    var h = height();
    startY = null;
    if (!moved) {
      var link = e.target && e.target.closest && e.target.closest("a");
      if (link && pages[0] && pages[0].classList.contains("open")) return;
      if (pages[0] && !pages[0].classList.contains("end")) pages[0].classList.toggle("open");
      return;
    }
    if ((dy < -h * 0.16 || v < -0.45) && pages[1]) go(1);
    else if ((dy > h * 0.16 || v > 0.45) && pages[-1]) go(-1);
    else place(0, true);
  }
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", function () { startY = null; place(0, true); });

  var wheelAcc = 0, wheelTimer = null;
  window.addEventListener("wheel", function (e) {
    e.preventDefault();
    if (busy) return;
    wheelAcc += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelAcc = 0; }, 160);
    if (wheelAcc > 40) { wheelAcc = 0; go(1); }
    else if (wheelAcc < -40) { wheelAcc = 0; go(-1); }
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (["ArrowDown", "PageDown", " ", "j"].indexOf(e.key) >= 0) { e.preventDefault(); go(1); }
    else if (["ArrowUp", "PageUp", "k"].indexOf(e.key) >= 0) { e.preventDefault(); go(-1); }
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
        b.chapters.forEach(function (c) {
          chapters.push({ book: b.name, year: b.year, n: c.n, date: c.date,
                          verses: c.verses, path: c.path, offset: total });
          total += c.verses;
        });
      });
      var g = parseRef(location.hash);
      if (g < 0) g = parseRef(store(POS_KEY));
      pos = g >= 0 ? g : 0;
      build();
      remember();
      if (!store(SWIPED_KEY) && total > 0) hint.hidden = false;
    })
    .catch(function () {
      stage.innerHTML = "";
      var p = makePage(0);
      p.querySelector(".verse").textContent = "The history could not be loaded. Check your connection.";
      stage.appendChild(p);
    });
})();
