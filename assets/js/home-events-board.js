var homeEventsBoardState = {
  timer: null,
  cleanup: []
};

var HOME_EVENTS_UPCOMING_LIMIT = 6;
var HOME_EVENTS_PAST_LIMIT = 2;
var HOME_EVENTS_PAST_LIMIT_ARCHIVE_FOCUS = 4;
var HOME_EVENTS_AUTOSCROLL_MS = 5200;
var HOME_EVENTS_DAY_MS = 24 * 60 * 60 * 1000;

async function initHomeEventsBoard() {
  teardownHomeEventsBoard();
  clearHomeEventsBoard();

  var initialFeed = [];
  if (typeof window.getTactEventFeedSnapshot === "function") {
    initialFeed = window.getTactEventFeedSnapshot();
  } else {
    initialFeed = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  var galleries = [];
  if (typeof window.getTactGallerySnapshot === "function") {
    galleries = window.getTactGallerySnapshot();
  }

  renderBoard(mergeGalleryFallbacks(initialFeed, galleries));

  if (typeof window.loadTactGalleryData === "function") {
    try {
      var freshGalleries = await window.loadTactGalleryData({ forceRefresh: true });
      if (Array.isArray(freshGalleries)) {
        galleries = freshGalleries;
        renderBoard(mergeGalleryFallbacks(initialFeed, galleries));
      }
    } catch (_galleryError) {
      galleries = galleries || [];
    }
  }

  if (typeof window.loadTactEventFeed === "function") {
    try {
      var freshFeed = await window.loadTactEventFeed({ forceRefresh: true });
      if (Array.isArray(freshFeed) && freshFeed.length) {
        renderBoard(mergeGalleryFallbacks(freshFeed, galleries));
      }
    } catch (_error) {
      // Keep the already-rendered local snapshot.
    }
  }
}

function renderBoard(feed) {
  teardownHomeEventsBoard();
  clearHomeEventsBoard();

  var items = Array.isArray(feed) ? feed.filter(hasUsableDate) : [];
  var today = getToday();
  var upcoming = [];
  var previous = [];

  items.forEach(function (item) {
    var date = parseDate(item.date);
    var status = String(item.status || "scheduled").toLowerCase();
    if (status !== "completed" && date >= today) {
      upcoming.push(item);
    } else {
      previous.push(item);
    }
  });

  upcoming.sort(function (left, right) {
    return parseDate(left.date) - parseDate(right.date);
  });
  previous.sort(function (left, right) {
    return parseDate(right.date) - parseDate(left.date);
  });

  applyBoardMode(upcoming, previous);
  updatePaneSummaries(upcoming, previous);
  var archiveFocus = !upcoming.length && previous.length > 0;

  var upcomingState = renderUpcomingCarousel(
    "home-upcoming-track",
    "home-upcoming-dots",
    upcoming.slice(0, HOME_EVENTS_UPCOMING_LIMIT),
    "No upcoming events right now.",
    archiveFocus
  );
  renderTrack(
    "home-previous-track",
    previous.slice(0, archiveFocus ? HOME_EVENTS_PAST_LIMIT_ARCHIVE_FOCUS : HOME_EVENTS_PAST_LIMIT),
    "Past events will appear here as the archive is updated.",
    true,
    false
  );

  if (upcomingState && upcomingState.count > 1) {
    autoScrollUpcoming(upcomingState);
  }
}

function mergeGalleryFallbacks(events, galleries) {
  var items = Array.isArray(events) ? events.slice() : [];
  var galleryIndex = buildGalleryIndex(galleries);
  if (!items.length) return items;

  return items.map(function (event) {
    var eventImage = String(event && (event.poster || event.image || event.thumbnail) || "").trim();
    if (eventImage) return event;

    var galleryImage = findGalleryImageForEvent(event, galleryIndex);
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

function buildGalleryIndex(galleries) {
  var index = {
    bySlug: {},
    byPage: {},
    byDateTitle: {}
  };

  (Array.isArray(galleries) ? galleries : []).forEach(function (entry) {
    var image = firstGalleryImage(entry);
    if (!image) return;

    var slugs = [
      entry.eventSlug,
      entry.slug,
      slugFromPath(entry.pageUrl)
    ];
    slugs.forEach(function (slug) {
      var key = normalizeKey(slug);
      if (key && !index.bySlug[key]) index.bySlug[key] = image;
    });

    var pageKey = normalizePath(entry.pageUrl);
    if (pageKey && !index.byPage[pageKey]) index.byPage[pageKey] = image;

    var dateTitleKey = dateTitleKeyFor(entry);
    if (dateTitleKey && !index.byDateTitle[dateTitleKey]) index.byDateTitle[dateTitleKey] = image;
  });

  return index;
}

function firstGalleryImage(entry) {
  var images = Array.isArray(entry && entry.images) ? entry.images : [];
  for (var i = 0; i < images.length; i++) {
    var url = String(images[i] && images[i].url || "").trim();
    if (url) return url;
  }
  return "";
}

function findGalleryImageForEvent(event, galleryIndex) {
  var slugKey = normalizeKey(event && event.slug);
  if (slugKey && galleryIndex.bySlug[slugKey]) return galleryIndex.bySlug[slugKey];

  var pageKey = normalizePath(buildEventPageUrl(event));
  if (pageKey && galleryIndex.byPage[pageKey]) return galleryIndex.byPage[pageKey];

  var pageSlugKey = normalizeKey(slugFromPath(buildEventPageUrl(event)));
  if (pageSlugKey && galleryIndex.bySlug[pageSlugKey]) return galleryIndex.bySlug[pageSlugKey];

  var dateTitleKey = dateTitleKeyFor(event);
  if (dateTitleKey && galleryIndex.byDateTitle[dateTitleKey]) return galleryIndex.byDateTitle[dateTitleKey];

  return "";
}

window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
window.TACT_PAGE_RUNTIME.initHomeEventsBoard = initHomeEventsBoard;
window.TACT_PAGE_RUNTIME.teardownHomeEventsBoard = teardownHomeEventsBoard;

if (document.getElementById("home-upcoming-track") && document.getElementById("home-previous-track")) {
  initHomeEventsBoard();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("home-upcoming-track") && document.getElementById("home-previous-track")) {
      initHomeEventsBoard();
    }
  }, { once: true });
}

function hasUsableDate(item) {
  return item && item.title && parseDate(item.date);
}

function getToday() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDate(value) {
  var date = new Date((value || "") + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  var date = parseDate(value);
  if (!date) return value || "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDatePart(value, options) {
  var date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", options);
}

function relativeDateLabel(value) {
  var date = parseDate(value);
  if (!date) return "Date TBA";
  var difference = Math.round((date - getToday()) / HOME_EVENTS_DAY_MS);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  if (difference > 1) return "In " + difference + " days";
  if (difference === -1) return "Yesterday";
  return Math.abs(difference) + " days ago";
}

function updatePaneSummaries(upcoming, previous) {
  setText("home-upcoming-count", upcomingCountLabel(upcoming.length));
  setText("home-past-count", countLabel(previous.length, "archived"));

  setText(
    "home-upcoming-note",
    upcoming.length ? "Next: " + formatDate(upcoming[0].date) : "Keep an eye on this space!"
  );
  setText(
    "home-past-note",
    previous.length ? "Latest: " + formatDate(previous[0].date) : "Archive updates appear here."
  );
}

function countLabel(count, suffix) {
  return count + " " + suffix;
}

function upcomingCountLabel(count) {
  return count > 0 ? countLabel(count, "scheduled") : "Stay tuned!";
}

function setText(id, value) {
  var node = document.getElementById(id);
  if (node) node.textContent = value;
}

function applyBoardMode(upcoming, previous) {
  var layout = document.querySelector(".home-events-layout");
  var upcomingPane = document.getElementById("home-upcoming-pane");
  var upcomingWindow = document.querySelector("#home-upcoming-pane .home-vertical-window");
  var archiveFocus = !upcoming.length && previous.length > 0;

  if (document.body) {
    document.body.classList.toggle("tact-home-events-archive-focus", archiveFocus);
  }
  if (layout) {
    layout.classList.toggle("home-events-layout--archive-focus", archiveFocus);
  }
  if (upcomingPane) {
    upcomingPane.classList.toggle("home-events-pane--compressed", archiveFocus);
  }
  if (upcomingWindow) {
    upcomingWindow.classList.toggle("home-vertical-window--compact", archiveFocus);
  }
}

function renderTrack(rootId, items, emptyMessage, isPast, expanded) {
  var root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = "";
  root.classList.remove("home-horizontal-track--expanded");

  if (!items.length) {
    root.innerHTML = '<p class="home-events-empty">' + escapeHtml(emptyMessage) + "</p>";
    return;
  }

  if (expanded) {
    root.classList.add("home-horizontal-track--expanded");
  }

  items.forEach(function (item) {
    root.appendChild(buildCard(item, isPast, expanded));
  });
}

function renderUpcomingCarousel(trackId, dotsId, items, emptyMessage, compactEmptyState) {
  var track = document.getElementById(trackId);
  var dots = document.getElementById(dotsId);
  if (!track || !dots) return null;

  track.innerHTML = "";
  dots.innerHTML = "";
  track.style.transition = "none";
  track.style.transform = "translateY(0)";

  if (!items.length) {
    track.innerHTML =
      '<p class="home-events-empty home-events-empty--upcoming' +
      (compactEmptyState ? " home-events-empty--upcoming-compact" : "") +
      '">' +
      escapeHtml(emptyMessage) +
      "</p>";
    dots.style.display = "none";
    return { count: 0 };
  }

  items.forEach(function (item) {
    track.appendChild(buildUpcomingCard(item));
  });

  var activeIndex = 0;
  var isAnimating = false;

  function paintDots() {
    var allDots = dots.querySelectorAll(".home-upcoming-dot");
    allDots.forEach(function (dot, index) {
      var isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function jumpTo(index) {
    if (isAnimating || !items.length) return;
    var targetIndex = ((index % items.length) + items.length) % items.length;
    if (targetIndex === activeIndex) return;

    while (activeIndex !== targetIndex) {
      var firstCard = track.firstElementChild;
      if (!firstCard) break;
      track.appendChild(firstCard);
      activeIndex = (activeIndex + 1) % items.length;
    }
    paintDots();
  }

  function advance() {
    var firstCard = track.firstElementChild;
    if (!firstCard || isAnimating) return;

    if (prefersReducedMotion()) {
      track.appendChild(firstCard);
      activeIndex = (activeIndex + 1) % items.length;
      paintDots();
      return;
    }

    isAnimating = true;
    var step = firstCard.offsetHeight;
    track.style.transition = "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)";
    track.style.transform = "translateY(-" + step + "px)";

    window.setTimeout(function () {
      track.style.transition = "none";
      track.style.transform = "translateY(0)";
      track.appendChild(firstCard);
      activeIndex = (activeIndex + 1) % items.length;
      isAnimating = false;
      paintDots();
    }, 720);
  }

  if (items.length > 1) {
    items.forEach(function (item, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "home-upcoming-dot";
      dot.setAttribute("aria-label", "Show " + displayTitle(item.title));
      addManagedListener(dot, "click", function () {
        jumpTo(index);
      });
      dots.appendChild(dot);
    });
    paintDots();
    dots.style.display = "inline-flex";
  } else {
    dots.style.display = "none";
  }

  return {
    count: items.length,
    track: track,
    dots: dots,
    advance: advance
  };
}

function buildCard(item, isPast, expandedPastCard) {
  var card = document.createElement("a");
  var title = displayTitle(item.title);
  var thumbnail = eventThumbnailUrl(item);
  var fallback = generatedEventThumbnailUrl(item);
  card.className =
    "home-events-item" +
    (isPast ? " home-events-item--past" : "") +
    (isPast && expandedPastCard ? " home-events-item--past-expanded" : "");
  card.href = buildEventPageUrl(item);
  card.setAttribute("aria-label", "View details for " + title);
  card.innerHTML =
    '<span class="home-events-thumb">' +
    '<img class="home-events-thumb-fill" src="' +
    escapeHtml(thumbnail) +
    '" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallback) + '\';" alt="" aria-hidden="true" loading="lazy" decoding="async">' +
    '<img class="home-events-thumb-main" src="' +
    escapeHtml(thumbnail) +
    '" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallback) + '\';" alt="' +
    escapeHtml(title + " poster") +
    '" loading="lazy" decoding="async">' +
    "</span>" +
    '<span class="home-events-body">' +
    buildBadges(item, isPast) +
    '<span class="home-events-meta">' +
    '<span>' + escapeHtml(formatDate(item.date)) + "</span>" +
    '<span>' + escapeHtml(cleanMeta(item.location, "Location TBA")) + "</span>" +
    "</span>" +
    "<h3>" +
    escapeHtml(title) +
    "</h3>" +
    "<p>" +
    escapeHtml(eventSummary(item)) +
    "</p>" +
    "</span>";
  return card;
}

function buildUpcomingCard(item) {
  var card = document.createElement("a");
  var title = displayTitle(item.title);
  var thumbnail = eventThumbnailUrl(item);
  var fallback = generatedEventThumbnailUrl(item);
  card.className = "home-upcoming-card";
  card.href = buildEventPageUrl(item);
  card.setAttribute("aria-label", "View details for " + title);
  card.innerHTML =
    '<div class="home-upcoming-media">' +
    '<img src="' +
    escapeHtml(thumbnail) +
    '" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallback) + '\';" alt="' +
    escapeHtml(title + " poster") +
    '" loading="eager" fetchpriority="high" decoding="async">' +
    "</div>" +
    '<div class="home-upcoming-copy">' +
    '<div class="home-event-card-head">' +
    buildDateTile(item.date) +
    '<div class="home-event-card-meta">' +
    buildBadges(item, false) +
    '<p class="home-events-meta">' +
    '<span>' + escapeHtml(cleanMeta(item.time, "Time TBA")) + "</span>" +
    '<span>' + escapeHtml(cleanMeta(item.location, "Location TBA")) + "</span>" +
    "</p>" +
    "</div>" +
    "</div>" +
    "<h3>" +
    escapeHtml(title) +
    "</h3>" +
    "<p>" +
    escapeHtml(eventSummary(item)) +
    "</p>" +
    '<span class="home-event-link-text">View details</span>' +
    "</div>";
  return card;
}

function buildDateTile(value) {
  return [
    '<div class="home-event-date" aria-hidden="true">',
    "  <span>" + escapeHtml(formatDatePart(value, { month: "short" })) + "</span>",
    "  <strong>" + escapeHtml(formatDatePart(value, { day: "2-digit" })) + "</strong>",
    "  <small>" + escapeHtml(formatDatePart(value, { year: "numeric" })) + "</small>",
    "</div>"
  ].join("");
}

function buildBadges(item, isPast) {
  var statusClass = isPast ? "home-event-badge--past" : "home-event-badge--soon";
  var statusText = isPast ? "Completed" : relativeDateLabel(item.date);
  return [
    '<span class="home-event-badges">',
    '  <span class="home-event-badge">' + escapeHtml(programLabel(item)) + "</span>",
    '  <span class="home-event-badge ' + statusClass + '">' + escapeHtml(statusText) + "</span>",
    "</span>"
  ].join("");
}

function programLabel(item) {
  var source = String((item.slug || "") + " " + (item.title || "")).toLowerCase();
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

function eventThumbnailUrl(item) {
  var image = String(item && (item.poster || item.image || item.thumbnail) || "").trim();
  return image ? resolveSitePath(image) : generatedEventThumbnailUrl(item);
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
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="' + palette.start + '"/>',
    '<stop offset="1" stop-color="' + palette.end + '"/>',
    "</linearGradient>",
    '<radialGradient id="glow" cx="78%" cy="12%" r="72%">',
    '<stop offset="0" stop-color="' + palette.glow + '" stop-opacity=".72"/>',
    '<stop offset=".58" stop-color="' + palette.glow + '" stop-opacity=".16"/>',
    '<stop offset="1" stop-color="' + palette.glow + '" stop-opacity="0"/>',
    "</radialGradient>",
    "</defs>",
    '<rect width="640" height="420" rx="0" fill="url(#bg)"/>',
    '<rect width="640" height="420" fill="url(#glow)"/>',
    '<path d="M0 320 C120 286 188 362 308 326 C434 288 494 232 640 260 L640 420 L0 420 Z" fill="rgba(255,255,255,.10)"/>',
    '<circle cx="544" cy="78" r="78" fill="rgba(255,255,255,.12)"/>',
    '<circle cx="512" cy="76" r="34" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>',
    '<text x="36" y="58" font-size="15" font-weight="800" letter-spacing="2.2" fill="rgba(255,255,255,.78)">' + escapeSvg(label.toUpperCase()) + "</text>",
    titleMarkup,
    subtitleMarkup,
    '<text x="36" y="370" font-size="13" font-weight="800" letter-spacing="1.8" fill="rgba(255,255,255,.68)">THE ACADEMY TRUST</text>',
    "</svg>"
  ].join("");

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
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

function wrapSvgText(value, maxLength, maxLines) {
  var words = String(value || "").split(/\s+/).filter(Boolean);
  var lines = [];
  var current = "";

  words.forEach(function (word) {
    var next = current ? current + " " + word : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
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

function eventSummary(item) {
  var text = String(item.homepageMatter || item.teaser || "").replace(/\s+/g, " ").trim();
  return text || "Details will be added soon.";
}

function cleanMeta(value, fallback) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^(tbd|unknown|na|n\/a)$/i.test(text)) return fallback;
  return text;
}

function displayTitle(value) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Event";

  var lower = text.toLowerCase();
  var smallWords = {
    a: true,
    an: true,
    and: true,
    at: true,
    for: true,
    in: true,
    of: true,
    on: true,
    the: true,
    to: true,
    with: true
  };
  var acronyms = {
    bel: "BEL",
    ias: "IAS",
    mes: "MES",
    om: "OM",
    soafal: "SOAFAL",
    srm: "SRM",
    stem: "STEM",
    tact: "tAcT"
  };

  return lower.split(" ").map(function (word, index) {
    return word.split("-").map(function (part, partIndex) {
      if (acronyms[part]) return acronyms[part];
      if (index > 0 && smallWords[part]) return part;
      if (partIndex > 0 && smallWords[part]) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join("-");
  }).join(" ");
}

function resolveSitePath(path) {
  var raw = String(path || "").trim();
  if (!raw) return "";
  if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.indexOf("data:") === 0 || raw.indexOf("../") === 0 || raw.indexOf("./") === 0 || raw.charAt(0) === "/") {
    return raw;
  }

  var root = document.body && document.body.dataset ? String(document.body.dataset.siteRoot || "").trim() : "";
  return (root ? root.replace(/\/?$/, "/") : "") + raw.replace(/^\/+/, "");
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

function buildEventPageUrl(item) {
  var helpers = window.TACT_EVENT_PAGES || {};
  if (typeof helpers.buildEventPageUrl === "function") {
    return helpers.buildEventPageUrl(item) || "events.html";
  }
  return String(item && item.pageUrl || "").trim() || "events.html";
}

function autoScrollUpcoming(state) {
  if (prefersReducedMotion()) return;

  function stopTimer() {
    if (homeEventsBoardState.timer) {
      window.clearInterval(homeEventsBoardState.timer);
      homeEventsBoardState.timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    homeEventsBoardState.timer = window.setInterval(state.advance, HOME_EVENTS_AUTOSCROLL_MS);
  }

  startTimer();
  addManagedListener(state.track, "mouseenter", stopTimer);
  addManagedListener(state.track, "mouseleave", startTimer);
  addManagedListener(state.track, "focusin", stopTimer);
  addManagedListener(state.track, "focusout", startTimer);
  addManagedListener(state.dots, "mouseenter", stopTimer);
  addManagedListener(state.dots, "mouseleave", startTimer);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function addManagedListener(target, type, handler) {
  if (!target) return;
  target.addEventListener(type, handler);
  homeEventsBoardState.cleanup.push(function () {
    target.removeEventListener(type, handler);
  });
}

function teardownHomeEventsBoard() {
  if (homeEventsBoardState.timer) {
    window.clearInterval(homeEventsBoardState.timer);
    homeEventsBoardState.timer = null;
  }

  homeEventsBoardState.cleanup.forEach(function (cleanup) {
    cleanup();
  });
  homeEventsBoardState.cleanup = [];
}

function clearHomeEventsBoard() {
  var upcomingTrack = document.getElementById("home-upcoming-track");
  var upcomingDots = document.getElementById("home-upcoming-dots");
  var previousTrack = document.getElementById("home-previous-track");

  if (upcomingTrack) {
    upcomingTrack.innerHTML = "";
    upcomingTrack.style.transition = "none";
    upcomingTrack.style.transform = "translateY(0)";
  }

  if (upcomingDots) {
    upcomingDots.innerHTML = "";
    upcomingDots.style.display = "none";
  }

  if (previousTrack) {
    previousTrack.innerHTML = "";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
