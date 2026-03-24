var homeEventsBoardState = {
  timer: null
};

async function initHomeEventsBoard() {
  teardownHomeEventsBoard();
  clearHomeEventsBoard();

  var initialFeed = [];
  if (typeof window.getTactEventFeedSnapshot === "function") {
    initialFeed = window.getTactEventFeedSnapshot();
  } else {
    initialFeed = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  renderBoard(initialFeed);

  if (typeof window.loadTactEventFeed === "function") {
    try {
      var freshFeed = await window.loadTactEventFeed({ forceRefresh: true });
      if (Array.isArray(freshFeed) && freshFeed.length) {
        renderBoard(freshFeed);
      }
    } catch (_error) {
      // Keep the already-rendered local snapshot.
    }
  }
}

function renderBoard(feed) {
  teardownHomeEventsBoard();
  clearHomeEventsBoard();

  if (!feed.length) {
    renderUpcomingCarousel(
      "home-upcoming-track",
      "home-upcoming-dots",
      [],
      "No upcoming events right now."
    );
    renderTrack("home-previous-track", [], "No past events available yet.", true);
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var upcoming = [];
  var previous = [];

  feed.forEach(function (item) {
    var date = parseDate(item.date);
    if (!date) return;
    var status = String(item.status || "scheduled").toLowerCase();
    if (status !== "completed" && date >= today) {
      upcoming.push(item);
    } else {
      previous.push(item);
    }
  });

  upcoming.sort(function (a, b) {
    return parseDate(a.date) - parseDate(b.date);
  });
  previous.sort(function (a, b) {
    return parseDate(b.date) - parseDate(a.date);
  });

  var upcomingState = renderUpcomingCarousel(
    "home-upcoming-track",
    "home-upcoming-dots",
    upcoming,
    "No upcoming events right now."
  );
  renderTrack("home-previous-track", previous.slice(0, 2), "No past events available yet.", true);

  if (upcomingState && upcomingState.count > 1) {
    autoScrollUpcoming(upcomingState);
  }
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

function renderTrack(rootId, items, emptyMessage, isPast) {
  var root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = "";

  if (!items.length) {
    root.innerHTML = '<p class="home-events-empty">' + escapeHtml(emptyMessage) + "</p>";
    return;
  }

  items.forEach(function (item) {
    root.appendChild(buildCard(item, isPast));
  });
}

function renderUpcomingCarousel(trackId, dotsId, items, emptyMessage) {
  var track = document.getElementById(trackId);
  var dots = document.getElementById(dotsId);
  if (!track || !dots) return null;

  track.innerHTML = "";
  dots.innerHTML = "";

  if (!items.length) {
    track.innerHTML = '<p class="home-events-empty" style="padding:12px;">' + escapeHtml(emptyMessage) + "</p>";
    dots.style.display = "none";
    return { count: 0 };
  }

  items.forEach(function (item) {
    track.appendChild(buildUpcomingCard(item));
  });

  var activeIndex = 0;

  function paintDots() {
    var allDots = dots.querySelectorAll(".home-upcoming-dot");
    allDots.forEach(function (dot, index) {
      dot.classList.toggle("is-active", index === activeIndex);
    });
  }

  function jumpTo(index) {
    if (index === activeIndex) return;
    while (activeIndex !== index) {
      var first = track.firstElementChild;
      if (!first) break;
      track.appendChild(first);
      activeIndex = (activeIndex + 1) % items.length;
    }
    paintDots();
  }

  function advance() {
    var first = track.firstElementChild;
    if (!first) return;

    var step = first.offsetHeight;
    track.style.transition = "transform 0.75s ease";
    track.style.transform = "translateY(-" + step + "px)";

    window.setTimeout(function () {
      track.style.transition = "none";
      track.style.transform = "translateY(0)";
      track.appendChild(first);
      activeIndex = (activeIndex + 1) % items.length;
      paintDots();
    }, 770);
  }

  if (items.length > 1) {
    items.forEach(function (_item, index) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "home-upcoming-dot";
      dot.setAttribute("aria-label", "Go to upcoming event " + (index + 1));
      dot.addEventListener("click", function () {
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

function buildCard(item, isPast) {
  var card = document.createElement("a");
  card.className = "home-events-item" + (isPast ? " home-events-item--past" : "");
  card.href = buildEventPageUrl(item);
  card.innerHTML =
    '<img src="' +
    escapeHtml(item.poster || "assets/images/tact-logo.jpg") +
    '" onerror="this.onerror=null;this.src=\'assets/images/tact-logo.jpg\';" alt="' +
    escapeHtml((item.title || "Event") + " poster") +
    '" loading="lazy" decoding="async">' +
    "<div>" +
    '<p class="home-events-meta">' +
    escapeHtml(formatDate(item.date)) +
    " | " +
    escapeHtml(item.time || "Time TBA") +
    " | " +
    escapeHtml(item.location || "Location TBA") +
    "</p>" +
    "<h3>" +
    escapeHtml(item.title || "Event") +
    "</h3>" +
    "<p>" +
    escapeHtml(item.homepageMatter || item.teaser || "") +
    "</p>" +
    "</div>";
  return card;
}

function buildUpcomingCard(item) {
  var card = document.createElement("a");
  card.className = "home-upcoming-card";
  card.href = buildEventPageUrl(item);
  card.innerHTML =
    '<div class="home-upcoming-media">' +
    '<img src="' +
    escapeHtml(item.poster || "assets/images/tact-logo.jpg") +
    '" onerror="this.onerror=null;this.src=\'assets/images/tact-logo.jpg\';" alt="' +
    escapeHtml((item.title || "Event") + " poster") +
    '" loading="eager" fetchpriority="high" decoding="async">' +
    "</div>" +
    '<div class="home-upcoming-copy">' +
    '<p class="home-events-meta">' +
    escapeHtml(formatDate(item.date)) +
    " | " +
    escapeHtml(item.time || "Time TBA") +
    " | " +
    escapeHtml(item.location || "Location TBA") +
    "</p>" +
    "<h3>" +
    escapeHtml(item.title || "Event") +
    "</h3>" +
    "<p>" +
    escapeHtml(item.homepageMatter || item.teaser || "") +
    "</p>" +
    "</div>";
  return card;
}

function buildEventPageUrl(item) {
  var helpers = window.TACT_EVENT_PAGES || {};
  if (typeof helpers.buildEventPageUrl === "function") {
    return helpers.buildEventPageUrl(item);
  }
  return String(item && item.pageUrl || "").trim();
}

function autoScrollUpcoming(state) {
  homeEventsBoardState.timer = window.setInterval(state.advance, 4300);
  state.track.addEventListener("mouseenter", function () {
    window.clearInterval(homeEventsBoardState.timer);
  });
  state.track.addEventListener("mouseleave", function () {
    window.clearInterval(homeEventsBoardState.timer);
    homeEventsBoardState.timer = window.setInterval(state.advance, 4300);
  });

  state.dots.addEventListener("mouseenter", function () {
    window.clearInterval(homeEventsBoardState.timer);
  });
  state.dots.addEventListener("mouseleave", function () {
    window.clearInterval(homeEventsBoardState.timer);
    homeEventsBoardState.timer = window.setInterval(state.advance, 4300);
  });
}

function teardownHomeEventsBoard() {
  if (homeEventsBoardState.timer) {
    window.clearInterval(homeEventsBoardState.timer);
    homeEventsBoardState.timer = null;
  }
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
