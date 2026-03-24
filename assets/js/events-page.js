async function initEventsPage() {
  renderPlaceholders();

  var initialEvents = [];
  if (typeof window.getTactEventFeedSnapshot === "function") {
    initialEvents = window.getTactEventFeedSnapshot();
  } else {
    initialEvents = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  var eventsToRender = initialEvents;

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
  var date = String(item && item.date || "").trim();
  var title = String(item && item.title || "").trim();
  var fromMeta = String(date + "--" + title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return String(item && item.pageUrl || ("events/" + (fromMeta || String(item && item.slug || "").trim()) + ".html"));
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
    link.className = "archive-item";
    link.href = buildEventPageUrl(item);
    link.innerHTML =
      '<img src="' +
      escapeHtml(item.poster || item.image || "assets/images/tact-logo.jpg") +
      '" onerror="this.onerror=null;this.src=\'assets/images/tact-logo.jpg\';" alt="' +
      escapeHtml(item.title || "Event image") +
      '" width="132" height="164" loading="lazy" decoding="async" style="object-fit:fill;">' +
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
  link.className = "event-card" + (isPriority ? " event-card--priority" : "");
  link.href = buildEventPageUrl(item);
  link.innerHTML =
    '<img src="' +
    escapeHtml(item.poster || item.image || "assets/images/tact-logo.jpg") +
    '" onerror="this.onerror=null;this.src=\'assets/images/tact-logo.jpg\';" alt="' +
    escapeHtml(item.title || "Event image") +
    '" width="132" height="164" loading="' +
    (isPriority ? "eager" : "lazy") +
    '" fetchpriority="' +
    (isPriority ? "high" : "auto") +
    '" decoding="' +
    (isPriority ? "sync" : "async") +
    '" style="object-fit:fill;">' +
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
