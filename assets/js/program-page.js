function initProgramPage() {
  if (window.TACT_CHROME) {
    if (typeof window.TACT_CHROME.ensureHeader === "function") {
      window.TACT_CHROME.ensureHeader();
    } else {
      window.TACT_CHROME.renderHeader();
    }
    window.TACT_CHROME.initDropdowns();
  }

  var body = document.body;
  var slug = body ? body.getAttribute("data-program-slug") : null;
  var data = window.TACT_PROGRAMS && slug ? window.TACT_PROGRAMS[slug] : null;

  if (!data) return;

  body.classList.add("program-page", "program-page--" + slug);
  document.title = data.title + " - The Academy Trust (tAcT)";
  setMetaDescription(data.heroText);

  var hero = document.getElementById("hero");
  hero.style.backgroundImage =
    "linear-gradient(180deg, rgba(8, 26, 20, 0.55), rgba(8, 26, 20, 0.55)), url('" + data.heroImage + "')";

  setText("program-title", data.title);
  setText("hero-text", data.heroText);
  setText("about-title", data.aboutTitle);
  setText("visit-title", data.visitTitle);
  setText("gallery-title", data.galleryTitle);
  setText("impact-text", data.impact);

  var badges = document.getElementById("badge-row");
  badges.innerHTML = "";
  data.badges.forEach(function (badge) {
    var span = document.createElement("span");
    span.className = "badge";
    span.textContent = badge;
    badges.appendChild(span);
  });
  renderHeroStats(data);

  var about = document.getElementById("about-content");
  about.innerHTML = "";
  data.about.forEach(function (line) {
    var p = document.createElement("p");
    p.textContent = line;
    about.appendChild(p);
  });
  renderProfile(data);

  var visit = document.getElementById("visit-list");
  visit.innerHTML = "";
  data.visit.forEach(function (line) {
    var li = document.createElement("li");
    if (typeof line === "string") {
      li.textContent = line;
    } else {
      var title = document.createElement("span");
      title.className = "visit-step-title";
      title.textContent = line.title || "";
      li.appendChild(title);

      var text = document.createElement("span");
      text.className = "visit-step-text";
      text.textContent = line.text || "";
      li.appendChild(text);
    }
    visit.appendChild(li);
  });
  renderMoments(data);

  var gallery = document.getElementById("gallery-grid");
  gallery.innerHTML = "";
  data.gallery.forEach(function (item) {
    if (item.type === "image") {
      var figure = document.createElement("figure");
      figure.className = "gallery-figure";

      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || data.title + " image";
      img.loading = "lazy";
      img.decoding = "async";
      figure.appendChild(img);

      if (item.caption) {
        var caption = document.createElement("figcaption");
        caption.textContent = item.caption;
        figure.appendChild(caption);
      }

      gallery.appendChild(figure);
      return;
    }

    if (item.type === "card") {
      var card = document.createElement("article");
      card.className = "surface gallery-card program-gallery-card";

      var h3 = document.createElement("h3");
      h3.textContent = item.title || "";
      card.appendChild(h3);

      var p = document.createElement("p");
      p.textContent = item.text || "";
      card.appendChild(p);

      gallery.appendChild(card);
      return;
    }

    if (item.type === "gallery_link") {
      renderEmbeddedGallery(gallery, item.programTag || "", item.linkText || "View all photos");
    }
  });
  renderImpactPoints(data);

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
window.TACT_PAGE_RUNTIME.initProgramPage = initProgramPage;

if (document.getElementById("program-title")) {
  initProgramPage();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("program-title")) {
      initProgramPage();
    }
  }, { once: true });
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setMetaDescription(value) {
  var meta = document.querySelector('meta[name="description"]');
  if (meta && value) meta.setAttribute("content", value);
}

function renderHeroStats(data) {
  var heroText = document.getElementById("hero-text");
  var hero = document.getElementById("hero");
  if (!heroText || !hero) return;

  removeExisting(hero, ".program-stat-row");
  if (!Array.isArray(data.stats) || !data.stats.length) return;

  var row = document.createElement("div");
  row.className = "program-stat-row";
  data.stats.forEach(function (item) {
    var card = document.createElement("span");
    card.className = "program-stat";

    var value = document.createElement("strong");
    value.textContent = item.value || "";
    card.appendChild(value);

    var label = document.createElement("span");
    label.textContent = item.label || "";
    card.appendChild(label);

    row.appendChild(card);
  });

  heroText.insertAdjacentElement("afterend", row);
}

function renderProfile(data) {
  var about = document.getElementById("about-content");
  if (!about) return;

  removeExisting(about, ".program-profile-grid");
  if (!Array.isArray(data.profile) || !data.profile.length) return;

  var grid = document.createElement("div");
  grid.className = "program-profile-grid";
  data.profile.forEach(function (item) {
    var card = document.createElement("article");
    card.className = "program-profile-card";

    var label = document.createElement("span");
    label.textContent = item.label || "";
    card.appendChild(label);

    var value = document.createElement("p");
    value.textContent = item.value || "";
    card.appendChild(value);

    grid.appendChild(card);
  });

  about.appendChild(grid);
}

function renderMoments(data) {
  var gallerySection = document.getElementById("gallery");
  if (!gallerySection) return;

  var existing = document.getElementById("program-moments");
  if (existing) existing.remove();

  if (!Array.isArray(data.moments) || !data.moments.length) return;

  var section = document.createElement("section");
  section.id = "program-moments";
  section.className = "section surface program-moments";

  var title = document.createElement("h2");
  title.textContent = data.momentsTitle || "Documented moments";
  section.appendChild(title);

  var grid = document.createElement("div");
  grid.className = "program-moment-grid";

  data.moments.forEach(function (item) {
    var card = document.createElement(item.pageUrl ? "a" : "article");
    card.className = "program-moment-card";
    if (item.pageUrl) card.href = item.pageUrl;

    var meta = document.createElement("span");
    meta.className = "program-moment-meta";
    meta.textContent = [item.date, item.place].filter(Boolean).join(" | ");
    card.appendChild(meta);

    var heading = document.createElement("h3");
    heading.textContent = item.title || "";
    card.appendChild(heading);

    var text = document.createElement("p");
    text.textContent = item.text || "";
    card.appendChild(text);

    grid.appendChild(card);
  });

  section.appendChild(grid);
  gallerySection.parentNode.insertBefore(section, gallerySection);
}

function renderImpactPoints(data) {
  var impactText = document.getElementById("impact-text");
  if (!impactText) return;

  var section = impactText.closest(".surface");
  if (!section) return;

  removeExisting(section, ".program-impact-list");
  if (!Array.isArray(data.impactPoints) || !data.impactPoints.length) return;

  var list = document.createElement("ul");
  list.className = "program-impact-list";
  data.impactPoints.forEach(function (item) {
    var li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  impactText.insertAdjacentElement("afterend", list);
}

function removeExisting(root, selector) {
  var existing = root.querySelector(selector);
  if (existing) existing.remove();
}

// ─── Embedded gallery for program pages ──────────────────────────────────────

var progGalleryLayoutPending = false;

function scheduleProgGalleryLayout(grid) {
  if (progGalleryLayoutPending) return;
  progGalleryLayoutPending = true;
  requestAnimationFrame(function () {
    progGalleryLayoutPending = false;
    layoutProgGallery(grid);
  });
}

function layoutProgGallery(grid) {
  if (!grid) return;
  var containerWidth = grid.getBoundingClientRect().width;
  if (!(containerWidth > 0)) return;

  var H   = 200;  // fixed row height (px)
  var GAP = 8;

  var cards = Array.from(grid.querySelectorAll(".prog-gallery-card"));
  if (!cards.length) return;

  var items = cards.map(function (card) {
    var img = card.querySelector("img");
    var ratio = (img && img.naturalWidth && img.naturalHeight)
      ? img.naturalWidth / img.naturalHeight
      : 4 / 3;
    return { card: card, ratio: ratio };
  });

  // Justified-row packing: compare distortion of including vs excluding next image
  var rows = [];
  var row = [];
  var rowSumWidths = 0;

  items.forEach(function (item) {
    var nw = H * item.ratio;

    if (row.length === 0) {
      row.push(item);
      rowSumWidths = nw;
      return;
    }

    var totalIfAdded = rowSumWidths + nw + row.length * GAP;

    if (totalIfAdded <= containerWidth) {
      row.push(item);
      rowSumWidths += nw;
    } else {
      var scaleWith    = (containerWidth -  row.length      * GAP) / (rowSumWidths + nw);
      var scaleWithout = (containerWidth - (row.length - 1) * GAP) /  rowSumWidths;
      var distortWith    = Math.max(scaleWith,    1 / scaleWith);
      var distortWithout = Math.max(scaleWithout, 1 / scaleWithout);
      var include = distortWith < distortWithout;

      if (include) { row.push(item); rowSumWidths += nw; }
      rows.push({ items: row.slice(), last: false });
      if (include) { row = []; rowSumWidths = 0; }
      else         { row = [item]; rowSumWidths = nw; }
    }
  });

  if (row.length) {
    rows.push({ items: row, last: true });
  }

  rows.forEach(function (rowData) {
    var n = rowData.items.length;
    var available = containerWidth - (n - 1) * GAP;
    var totalNaturalWidth = rowData.items.reduce(function (s, item) {
      return s + H * item.ratio;
    }, 0);
    var scale = rowData.last ? 1.0 : available / totalNaturalWidth;

    var assignedWidth = 0;
    rowData.items.forEach(function (item, i) {
      var isLast = i === n - 1;
      var w = (!rowData.last && isLast)
        ? Math.round(available - assignedWidth)
        : Math.round(H * item.ratio * scale);
      w = Math.max(10, w);
      assignedWidth += w;
      item.card.style.flex   = "0 0 " + w + "px";
      item.card.style.width  = w + "px";
      item.card.style.height = H + "px";
    });
  });
}

async function renderEmbeddedGallery(container, programTag, linkText) {
  if (typeof window.loadTactGalleryData !== "function") {
    // gallery-data.js not loaded — show a plain link card instead
    var fallback = document.createElement("a");
    fallback.className = "program-gallery-link-card";
    fallback.href = "gallery.html#program=" + encodeURIComponent(programTag);
    fallback.textContent = linkText;
    container.appendChild(fallback);
    return;
  }

  container.innerHTML = '<p class="prog-gallery-loading">Loading gallery…</p>';

  var entries;
  try {
    entries = await window.loadTactGalleryData();
  } catch (e) {
    container.innerHTML = '<p class="prog-gallery-empty">Gallery unavailable.</p>';
    return;
  }

  // Flatten entries that match this program tag, newest first
  var items = [];
  entries.forEach(function (entry) {
    if ((entry.program || "") !== programTag) return;
    entry.images.forEach(function (image) {
      items.push({
        url:     image.url,
        title:   entry.title,
        date:    entry.date,
        pageUrl: entry.pageUrl || "#"
      });
    });
  });

  items.sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });

  if (!items.length) {
    container.innerHTML = '<p class="prog-gallery-empty">No gallery photos yet.</p>';
    return;
  }

  container.innerHTML = "";

  // Build the flex grid (show up to 16 images)
  var grid = document.createElement("div");
  grid.className = "prog-gallery-grid";

  items.slice(0, 16).forEach(function (item) {
    var a = document.createElement("a");
    a.className = "prog-gallery-card";
    a.href = item.pageUrl;
    a.title = item.title;

    var img = document.createElement("img");
    img.src = item.url;
    img.alt = item.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("load", function () { scheduleProgGalleryLayout(grid); });

    a.appendChild(img);
    grid.appendChild(a);
  });

  container.appendChild(grid);

  // "View all" footer
  var footer = document.createElement("div");
  footer.className = "prog-gallery-footer";
  var allLink = document.createElement("a");
  allLink.href = "gallery.html#program=" + encodeURIComponent(programTag);
  allLink.className = "prog-gallery-all-link";
  allLink.textContent = linkText + " →";
  footer.appendChild(allLink);
  container.appendChild(footer);

  // Initial layout pass (before images load, uses 4:3 fallback ratio)
  scheduleProgGalleryLayout(grid);

  // Re-layout when window resizes
  window.addEventListener("resize", function () { scheduleProgGalleryLayout(grid); });
}
