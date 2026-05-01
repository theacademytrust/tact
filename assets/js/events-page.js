async function initEventsPage() {
  renderPlaceholders();

  var initialEvents = [];
  if (typeof window.getTactEventFeedSnapshot === "function") {
    initialEvents = window.getTactEventFeedSnapshot();
  } else {
    initialEvents = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  var eventsToRender = initialEvents;
  var galleries = [];

  if (typeof window.getTactGallerySnapshot === "function") {
    galleries = window.getTactGallerySnapshot();
  }

  if (typeof window.loadTactGalleryData === "function") {
    try {
      var freshGalleries = await window.loadTactGalleryData({ forceRefresh: true });
      if (Array.isArray(freshGalleries) && freshGalleries.length) {
        galleries = freshGalleries;
      }
    } catch (_galleryError) {
      galleries = galleries || [];
    }
  }

  if (typeof window.loadTactEventFeed === "function") {
    try {
      var freshEvents = await window.loadTactEventFeed({ forceRefresh: true });
      if (Array.isArray(freshEvents) && freshEvents.length) {
        eventsToRender = freshEvents;
      }
    } catch (_error) {
      eventsToRender = initialEvents;
    }
  }

  eventsToRender = mergeGalleryFallbacks(eventsToRender, galleries);

  preloadPriorityPoster(eventsToRender);
  renderEventSections(eventsToRender);
  setEventsPageLoading(false);

  scheduleAsync(function () {
    if (window.TACT_CHROME) {
      if (typeof window.TACT_CHROME.ensureHeader === "function") {
        window.TACT_CHROME.ensureHeader();
      } else {
        window.TACT_CHROME.renderHeader();
      }
      window.TACT_CHROME.initDropdowns();
    }

    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
}

window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
window.TACT_PAGE_RUNTIME.initEventsPage = initEventsPage;

function scheduleAsync(callback) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(function () {
      window.setTimeout(callback, 0);
    });
    return;
  }

  window.setTimeout(callback, 0);
}

function renderPlaceholders() {
  populatePlaceholderCards("upcoming-list", 4);
  populatePlaceholderCards("archive-list", 2);
}

function populatePlaceholderCards(rootId, count) {
  var root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = "";
  for (var i = 0; i < count; i++) {
    root.insertAdjacentHTML(
      "beforeend",
      '<article class="event-card event-card-placeholder" aria-hidden="true">' +
        '<div class="event-card-placeholder__image"></div>' +
        '<div class="event-card-placeholder__body">' +
          '<span class="event-card-placeholder__line" style="width:70%;"></span>' +
          '<span class="event-card-placeholder__line" style="width:60%;"></span>' +
          '<span class="event-card-placeholder__line" style="width:40%;"></span>' +
        "</div>" +
      "</article>"
    );
  }
}

if (document.getElementById("upcoming-list") && document.getElementById("archive-list")) {
  initEventsPage();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    initEventsPage();
  }, { once: true });
}

function renderEventSections(events) {
  var buckets = splitEvents(events);
  renderUpcoming(buckets.upcoming);
  renderArchive(buckets.archive);
}

function mergeGalleryFallbacks(events, galleries) {
  var items = Array.isArray(events) ? events.slice() : [];
  var entries = Array.isArray(galleries) ? galleries : [];
  if (!items.length || !entries.length) return items;

  var galleryBySlug = {};
  var galleryByPage = {};
  var galleryByDateTitle = {};
  entries.forEach(function (entry) {
    var eventSlug = String(entry && (entry.eventSlug || entry.slug) || "").trim();
    var images = Array.isArray(entry.images) ? entry.images : [];
    var firstImage = images.find(function (image) {
      return image && image.url;
    });
    if (firstImage && firstImage.url) {
      var imageUrl = String(firstImage.url).trim();
      [eventSlug, entry.slug, slugFromPath(entry.pageUrl)].forEach(function (slug) {
        var slugKey = normalizeKey(slug);
        if (slugKey && !galleryBySlug[slugKey]) galleryBySlug[slugKey] = imageUrl;
      });
      var pageKey = normalizePath(entry.pageUrl);
      if (pageKey && !galleryByPage[pageKey]) galleryByPage[pageKey] = imageUrl;
      var dateTitleKey = dateTitleKeyFor(entry);
      if (dateTitleKey && !galleryByDateTitle[dateTitleKey]) galleryByDateTitle[dateTitleKey] = imageUrl;
    }
  });

  return items.map(function (event) {
    var poster = String(event && (event.poster || event.image) || "").trim();
    if (poster) return event;

    var slugKey = normalizeKey(event && event.slug);
    var pageKey = normalizePath(buildEventPageUrl(event));
    var pageSlugKey = normalizeKey(slugFromPath(buildEventPageUrl(event)));
    var dateTitleKey = dateTitleKeyFor(event);
    var galleryImage = galleryBySlug[slugKey] || galleryByPage[pageKey] || galleryBySlug[pageSlugKey] || galleryByDateTitle[dateTitleKey];
    if (!galleryImage) return event;

    var copy = {};
    for (var key in event) {
      if (Object.prototype.hasOwnProperty.call(event, key)) {
        copy[key] = event[key];
      }
    }
    copy.image = galleryImage;
    return copy;
  });
}

function splitEvents(events) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var upcoming = [];
  var archive = [];

  events.forEach(function (event) {
    var date = parseDate(event.date);
    if (!date) return;

    var status = String(event.status || "scheduled").toLowerCase();
    if (status !== "completed" && date >= today) {
      upcoming.push(event);
    } else {
      archive.push(event);
    }
  });

  upcoming.sort(function (a, b) {
    return parseDate(a.date) - parseDate(b.date);
  });

  archive.sort(function (a, b) {
    return parseDate(b.date) - parseDate(a.date);
  });

  return { upcoming: upcoming, archive: archive };
}

function preloadPriorityPoster(events) {
  var buckets = splitEvents(events);
  var first = buckets.upcoming[0];
  if (!first) return;

  var posterUrl = String(first.poster || first.image || "").trim();
  if (!posterUrl) return;

  ensureImagePreload(posterUrl);

  var warm = new Image();
  warm.fetchPriority = "high";
  warm.decoding = "sync";
  warm.src = posterUrl;
}

function ensureImagePreload(url) {
  var head = document.head || document.getElementsByTagName("head")[0];
  if (!head) return;

  var existing = document.querySelector('link[rel="preload"][as="image"][href="' + cssEscape(url) + '"]');
  if (existing) return;

  var link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  head.appendChild(link);
}

function cssEscape(value) {
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function buildEventPageUrl(item) {
  var helpers = window.TACT_EVENT_PAGES || {};
  if (typeof helpers.buildEventPageUrl === "function") {
    return helpers.buildEventPageUrl(item);
  }
  return String(item && item.pageUrl || "").trim();
}

function sameEventList(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function parseDate(value) {
  if (!value) return null;
  var date = new Date(value + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  var date = parseDate(value);
  if (!date) return value || "";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function eventThumbnailUrl(item) {
  var image = String(item && (item.poster || item.image || item.thumbnail) || "").trim();
  return image || generatedEventThumbnailUrl(item);
}

function generatedEventThumbnailUrl(item) {
  var label = programLabel(item);
  var title = displayTitle(item && item.title);
  var date = formatDate(item && item.date);
  var palette = thumbnailPalette(label);
  var titleLines = wrapSvgText(title, 29, 3);
  var subtitle = [date, cleanMeta(item && item.location, "")].filter(Boolean).join(" | ");
  var subtitleLines = wrapSvgText(subtitle, 36, 2);
  var titleMarkup = titleLines.map(function (line, index) {
    return '<text x="36" y="' + (126 + index * 34) + '" font-size="28" font-weight="800" fill="#f8faf8">' + escapeSvg(line) + "</text>";
  }).join("");
  var subtitleMarkup = subtitleLines.map(function (line, index) {
    return '<text x="36" y="' + (258 + index * 21) + '" font-size="15" font-weight="650" fill="rgba(255,255,255,0.82)">' + escapeSvg(line) + "</text>";
  }).join("");
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-label="' + escapeSvg(title) + '">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="' + palette.start + '"/><stop offset="1" stop-color="' + palette.end + '"/>',
    '</linearGradient><radialGradient id="glow" cx="78%" cy="12%" r="72%">',
    '<stop offset="0" stop-color="' + palette.glow + '" stop-opacity=".72"/><stop offset=".58" stop-color="' + palette.glow + '" stop-opacity=".16"/><stop offset="1" stop-color="' + palette.glow + '" stop-opacity="0"/>',
    "</radialGradient></defs>",
    '<rect width="640" height="420" fill="url(#bg)"/><rect width="640" height="420" fill="url(#glow)"/>',
    '<path d="M0 320 C120 286 188 362 308 326 C434 288 494 232 640 260 L640 420 L0 420 Z" fill="rgba(255,255,255,.10)"/>',
    '<circle cx="544" cy="78" r="78" fill="rgba(255,255,255,.12)"/><circle cx="512" cy="76" r="34" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>',
    '<text x="36" y="58" font-size="15" font-weight="800" letter-spacing="2.2" fill="rgba(255,255,255,.78)">' + escapeSvg(label.toUpperCase()) + "</text>",
    titleMarkup,
    subtitleMarkup,
    '<text x="36" y="370" font-size="13" font-weight="800" letter-spacing="1.8" fill="rgba(255,255,255,.68)">THE ACADEMY TRUST</text>',
    "</svg>"
  ].join("");

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function programLabel(item) {
  var source = String((item && item.slug || "") + " " + (item && item.title || "")).toLowerCase();
  if (source.indexOf("soafal") >= 0) return "SOAFAL";
  if (source.indexOf("vijnana-harate") >= 0 || source.indexOf("vijnana harate") >= 0) return "Vijnana Harate";
  if (source.indexOf("vijnana-aranya") >= 0 || source.indexOf("vijnana aranya") >= 0) return "Vijnana Aranya";
  if (source.indexOf("vijnana-yuvati") >= 0 || source.indexOf("vijnana yuvati") >= 0) return "Vijnana Yuvati";
  if (source.indexOf("vijnana-nataka") >= 0 || source.indexOf("vijnana nataka") >= 0) return "Vijnana Nataka";
  if (source.indexOf("ganitha") >= 0) return "Ganitha Mela";
  if (source.indexOf("mentor") >= 0) return "Mentorship";
  if (source.indexOf("workshop") >= 0 || source.indexOf("training") >= 0) return "Workshop";
  if (source.indexOf("mathematics") >= 0) return "Mathematics";
  if (source.indexOf("science") >= 0) return "Science Outreach";
  return "Outreach";
}

function thumbnailPalette(label) {
  var key = normalizeKey(label);
  if (key.indexOf("soafal") >= 0) return { start: "#17416a", end: "#0a7a3a", glow: "#d3a11f" };
  if (key.indexOf("vijnana-harate") >= 0) return { start: "#0b6b4f", end: "#0f766e", glow: "#f2c94c" };
  if (key.indexOf("vijnana-aranya") >= 0) return { start: "#115e37", end: "#365314", glow: "#a7f3d0" };
  if (key.indexOf("vijnana-yuvati") >= 0) return { start: "#7c2d12", end: "#0f766e", glow: "#fdba74" };
  if (key.indexOf("vijnana-nataka") >= 0) return { start: "#581c87", end: "#166534", glow: "#f0abfc" };
  if (key.indexOf("mathematics") >= 0 || key.indexOf("ganitha") >= 0) return { start: "#713f12", end: "#065f46", glow: "#fde68a" };
  if (key.indexOf("workshop") >= 0) return { start: "#1e3a8a", end: "#0f766e", glow: "#93c5fd" };
  return { start: "#12372a", end: "#0a7a3a", glow: "#d6b45a" };
}

function displayTitle(value) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Event";
  return text.toLowerCase().replace(/\b[a-z]/g, function (letter) {
    return letter.toUpperCase();
  }).replace(/\bSoafal\b/g, "SOAFAL").replace(/\bStem\b/g, "STEM").replace(/\bTact\b/g, "tAcT");
}

function cleanMeta(value, fallback) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^(tbd|unknown|na|n\/a)$/i.test(text)) return fallback;
  return text;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.html(?:\?.*)?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePath(value) {
  return String(value || "")
    .trim()
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .toLowerCase();
}

function slugFromPath(value) {
  var path = normalizePath(value);
  var filename = path.split("/").pop() || "";
  return filename.replace(/\.html$/i, "");
}

function dateTitleKeyFor(item) {
  if (!item) return "";
  return normalizeKey(String(item.date || "") + "-" + String(item.title || ""));
}

function wrapSvgText(value, maxLength, maxLines) {
  var words = String(value || "").split(/\s+/).filter(Boolean);
  var lines = [];
  var current = "";
  words.forEach(function (word) {
    var next = current ? current + " " + word : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  var clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = clipped[maxLines - 1].replace(/\s+\S*$/, "") + "...";
  return clipped;
}

function escapeSvg(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderUpcoming(list) {
  var root = document.getElementById("upcoming-list");
  if (!root) return;
  root.innerHTML = "";

  if (!list.length) {
    root.innerHTML = '<p class="empty">No upcoming events right now.</p>';
    return;
  }

  root.appendChild(buildUpcomingCard(list[0], true));

  if (list.length > 1) {
    scheduleAsync(function () {
      list.slice(1).forEach(function (item) {
        root.appendChild(buildUpcomingCard(item, false));
      });
    });
  }
}

function renderArchive(list) {
  var root = document.getElementById("archive-list");
  if (!root) return;
  root.innerHTML = "";

  if (!list.length) {
    root.innerHTML = '<p class="empty">No archived events yet.</p>';
    return;
  }

  list.forEach(function (item) {
    var link = document.createElement("a");
    var imageUrl = eventThumbnailUrl(item);
    var fallback = generatedEventThumbnailUrl(item);
    link.className = "archive-item";
    link.href = buildEventPageUrl(item);
    link.innerHTML =
      '<div class="image-container"><img src="' +
      escapeHtml(imageUrl) +
      '" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallback) + '\';" alt="' +
      escapeHtml(item.title || "Event image") +
      '" loading="lazy" decoding="async"></div>' +
      '<div class="archive-body">' +
      '<span class="meta">' +
      escapeHtml(formatDate(item.date)) +
      " | " +
      escapeHtml(item.time || "Time TBA") +
      " | " +
      escapeHtml(item.location || "TBA") +
      "</span>" +
      "<h3>" +
      escapeHtml(item.title || "Untitled event") +
      "</h3>" +
      "<p>" +
      escapeHtml(item.teaser || item.homepageMatter || "") +
      "</p>" +
      "</div>";
    root.appendChild(link);
  });
}

function buildUpcomingCard(item, isPriority) {
  var link = document.createElement("a");
  var imageUrl = eventThumbnailUrl(item);
  var fallback = generatedEventThumbnailUrl(item);
  link.className = "event-card" + (isPriority ? " event-card--priority" : "");
  link.href = buildEventPageUrl(item);
  link.innerHTML =
    '<div class="image-container"><img src="' +
    escapeHtml(imageUrl) +
    '" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallback) + '\';" alt="' +
    escapeHtml(item.title || "Event image") +
    '" loading="' +
    (isPriority ? "eager" : "lazy") +
    '" fetchpriority="' +
    (isPriority ? "high" : "auto") +
    '" decoding="' +
    (isPriority ? "sync" : "async") +
    '"></div>' +
    '<div class="event-body">' +
    '<span class="meta">' +
    escapeHtml(formatDate(item.date)) +
    " | " +
    escapeHtml(item.time || "Time TBA") +
    " | " +
    escapeHtml(item.location || "TBA") +
    "</span>" +
    "<h3>" +
    escapeHtml(item.title || "Untitled event") +
    "</h3>" +
    "<p>" +
    escapeHtml(item.teaser || item.homepageMatter || "") +
    "</p>" +
    "</div>";
  return link;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
