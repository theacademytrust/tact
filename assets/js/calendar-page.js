(function () {
  var CALENDAR_BATCH_SIZE = 12;

  var state = {
    entries: [],
    dayMap: {},
    sortedDateKeys: [],
    renderedCount: 0,
    lastRenderedMonthKey: "",
    scrollObserver: null,
    previewTimers: [],
    activeDateItems: [],
    detailOpen: false,
    initInFlight: null,
    eventsBound: false
  };

  function parseDate(value) {
    var parsed = new Date(String(value || "") + "T00:00:00");
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    var parsed = parseDate(value);
    if (!parsed) return value || "";
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function monthKeyFor(dateKey) {
    var parsed = parseDate(dateKey);
    if (!parsed) return "";
    return parsed.getFullYear() + "-" + String(parsed.getMonth() + 1).padStart(2, "0");
  }

  function monthLabelFor(dateKey) {
    var parsed = parseDate(dateKey);
    if (!parsed) return "";
    return parsed.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }

  function shortText(value, limit) {
    var text = String(value || "").trim();
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function flattenEntries(entries) {
    var days = {};

    entries.forEach(function (entry) {
      var key = String(entry.date || "");
      if (!key) return;
      if (!days[key]) days[key] = [];

      entry.images.forEach(function (image, index) {
        days[key].push({
          id: entry.slug + "-" + index,
          title: entry.title,
          date: entry.date,
          location: entry.location,
          description: image.description,
          url: image.url
        });
      });
    });

    return days;
  }

  function cleanupPreviewTimers() {
    state.previewTimers.forEach(function (timer) {
      window.clearInterval(timer);
    });
    state.previewTimers = [];
  }

  function disconnectScrollObserver() {
    if (!state.scrollObserver) return;
    state.scrollObserver.disconnect();
    state.scrollObserver = null;
  }

  function uniqueTextValues(items, key) {
    var seen = {};
    var values = [];

    items.forEach(function (item) {
      var value = String(item && item[key] || "").trim();
      var normalized = value.toLowerCase();
      if (!value || seen[normalized]) return;
      seen[normalized] = true;
      values.push(value);
    });

    return values;
  }

  function eventCountLabel(items) {
    var eventCount = uniqueTextValues(items, "title").length || items.length;
    return eventCount + " event" + (eventCount === 1 ? "" : "s");
  }

  function imageCountLabel(items) {
    return items.length + " image" + (items.length === 1 ? "" : "s");
  }

  function buildEventDateCard(dateKey, items) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day calendar-event-card has-gallery";
    button.dataset.dateKey = dateKey;

    var parsedDate = parseDate(dateKey) || new Date();
    var titles = uniqueTextValues(items, "title");
    var locations = uniqueTextValues(items, "location");
    var title = titles[0] || "Gallery event";
    var extraTitleCount = Math.max(0, titles.length - 1);

    var head = document.createElement("span");
    head.className = "calendar-date-card-head";

    var dateChip = document.createElement("span");
    dateChip.className = "calendar-date-chip";
    dateChip.innerHTML =
      "<strong>" + escapeHtml(String(parsedDate.getDate())) + "</strong>" +
      "<span>" + escapeHtml(parsedDate.toLocaleDateString("en-IN", { weekday: "short" })) + "</span>";

    var summary = document.createElement("span");
    summary.className = "calendar-date-summary";
    summary.innerHTML =
      "<strong>" + escapeHtml(formatDate(dateKey)) + "</strong>" +
      "<span>" + escapeHtml(locations.join(" / ") || "Location TBA") + "</span>";

    head.appendChild(dateChip);
    head.appendChild(summary);
    button.appendChild(head);

    var previewWrap = document.createElement("span");
    previewWrap.className = "calendar-preview";

    var image = document.createElement("img");
    image.className = "calendar-preview-image";
    image.src = items[0].url;
    image.alt = items[0].title;
    image.loading = "lazy";
    image.decoding = "async";
    previewWrap.appendChild(image);

    var overlay = document.createElement("span");
    overlay.className = "calendar-preview-overlay";
    overlay.innerHTML =
      "<strong>" + escapeHtml(items[0].title) + "</strong>" +
      "<span>" + escapeHtml(formatDate(items[0].date)) + "</span>" +
      "<span>" + escapeHtml(items[0].location) + "</span>" +
      "<span>" + escapeHtml(shortText(items[0].description, 90)) + "</span>";
    previewWrap.appendChild(overlay);
    button.appendChild(previewWrap);

    if (items.length > 1) {
      var index = 0;
      state.previewTimers.push(window.setInterval(function () {
        index = (index + 1) % items.length;
        image.src = items[index].url;
        image.alt = items[index].title;
        overlay.innerHTML =
          "<strong>" + escapeHtml(items[index].title) + "</strong>" +
          "<span>" + escapeHtml(formatDate(items[index].date)) + "</span>" +
          "<span>" + escapeHtml(items[index].location) + "</span>" +
          "<span>" + escapeHtml(shortText(items[index].description, 90)) + "</span>";
      }, 3200));
    }

    var count = document.createElement("span");
    count.className = "calendar-day-count";
    count.textContent = eventCountLabel(items) + " · " + imageCountLabel(items);
    button.appendChild(count);

    var eventTitle = document.createElement("span");
    eventTitle.className = "calendar-event-title";
    eventTitle.textContent = extraTitleCount ? title + " +" + extraTitleCount + " more" : title;
    button.appendChild(eventTitle);

    return button;
  }

  function buildMonthBreak(dateKey) {
    var node = document.createElement("div");
    node.className = "calendar-month-break";
    node.setAttribute("role", "heading");
    node.setAttribute("aria-level", "2");
    node.textContent = monthLabelFor(dateKey);
    return node;
  }

  function visibleDateKeys() {
    return Object.keys(state.dayMap).filter(function (dateKey) {
      return parseDate(dateKey) && (state.dayMap[dateKey] || []).length;
    }).sort(function (left, right) {
      return String(right).localeCompare(String(left));
    });
  }

  function appendNextBatch() {
    var grid = document.getElementById("calendar-grid");
    var sentinel = document.getElementById("calendar-sentinel");
    if (!grid) return;

    var nextKeys = state.sortedDateKeys.slice(state.renderedCount, state.renderedCount + CALENDAR_BATCH_SIZE);
    nextKeys.forEach(function (dateKey) {
      var monthKey = monthKeyFor(dateKey);
      if (monthKey && monthKey !== state.lastRenderedMonthKey) {
        grid.appendChild(buildMonthBreak(dateKey));
        state.lastRenderedMonthKey = monthKey;
      }
      grid.appendChild(buildEventDateCard(dateKey, state.dayMap[dateKey] || []));
    });

    state.renderedCount += nextKeys.length;

    if (sentinel) {
      sentinel.hidden = state.renderedCount >= state.sortedDateKeys.length;
      sentinel.textContent = sentinel.hidden ? "" : "Loading more";
    }
  }

  function setupScrollLoader() {
    var sentinel = document.getElementById("calendar-sentinel");
    if (!sentinel || state.renderedCount >= state.sortedDateKeys.length) return;

    if (!("IntersectionObserver" in window)) {
      while (state.renderedCount < state.sortedDateKeys.length) appendNextBatch();
      return;
    }

    state.scrollObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) appendNextBatch();
      });
    }, { rootMargin: "420px 0px" });
    state.scrollObserver.observe(sentinel);
  }

  function renderCalendar() {
    cleanupPreviewTimers();
    disconnectScrollObserver();

    var grid = document.getElementById("calendar-grid");
    var sentinel = document.getElementById("calendar-sentinel");
    if (!grid) return;

    state.sortedDateKeys = visibleDateKeys();
    state.renderedCount = 0;
    state.lastRenderedMonthKey = "";
    grid.innerHTML = "";

    if (!state.sortedDateKeys.length) {
      var empty = document.createElement("p");
      empty.className = "calendar-empty";
      empty.textContent = "Gallery dates will appear here as images are added.";
      grid.appendChild(empty);
      if (sentinel) {
        sentinel.hidden = true;
        sentinel.textContent = "";
      }
      return;
    }

    if (sentinel) sentinel.hidden = false;
    appendNextBatch();
    setupScrollLoader();
  }

  function openDateModal(dateKey) {
    var items = state.dayMap[dateKey] || [];
    state.activeDateItems = items.slice();

    var modal = document.getElementById("calendar-date-modal");
    var title = document.getElementById("calendar-date-modal-title");
    var grid = document.getElementById("calendar-date-grid");
    if (!modal || !title || !grid) return;

    title.textContent = "Gallery for " + formatDate(dateKey);
    grid.innerHTML = "";

    state.activeDateItems.forEach(function (item, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-modal-card";
      button.dataset.itemIndex = String(index);

      var image = document.createElement("img");
      image.src = item.url;
      image.alt = item.title;
      image.loading = "lazy";
      image.decoding = "async";

      var meta = document.createElement("span");
      meta.className = "calendar-modal-card-meta";
      meta.innerHTML =
        "<strong>" + escapeHtml(item.title) + "</strong>" +
        "<span>" + escapeHtml(item.location) + "</span>";

      button.appendChild(image);
      button.appendChild(meta);
      grid.appendChild(button);
    });

    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeDateModal() {
    var modal = document.getElementById("calendar-date-modal");
    if (!modal) return;

    modal.hidden = true;
    if (!state.detailOpen) {
      document.body.classList.remove("modal-open");
    }
  }

  function syncDetailModalHeight() {
    if (!state.detailOpen) return;

    var layout = document.querySelector("#calendar-detail-modal .calendar-detail-layout");
    var image = document.getElementById("calendar-detail-image");
    if (!layout || !image) return;

    var apply = function () {
      var rect = image.getBoundingClientRect();
      var nextHeight = Math.max(220, Math.round(rect.height || 0));
      layout.style.setProperty("--calendar-detail-media-height", nextHeight + "px");
    };

    if (image.complete) {
      window.requestAnimationFrame(apply);
      return;
    }

    image.onload = apply;
  }

  function openDetailModal(item) {
    var modal = document.getElementById("calendar-detail-modal");
    var layout = modal ? modal.querySelector(".calendar-detail-layout") : null;
    var image = document.getElementById("calendar-detail-image");
    if (!modal || !layout || !image || !item) return;

    state.detailOpen = true;
    image.src = item.url;
    image.alt = item.title;
    document.getElementById("calendar-detail-title").textContent = item.title;
    document.getElementById("calendar-detail-date").textContent = formatDate(item.date);
    document.getElementById("calendar-detail-location").textContent = item.location;
    document.getElementById("calendar-detail-description").textContent = item.description;
    layout.style.setProperty("--calendar-detail-media-height", "76vh");

    modal.hidden = false;
    document.body.classList.add("modal-open");
    syncDetailModalHeight();
  }

  function closeDetailModal() {
    var modal = document.getElementById("calendar-detail-modal");
    var layout = modal ? modal.querySelector(".calendar-detail-layout") : null;
    if (!modal) return;

    modal.hidden = true;
    if (layout) {
      layout.style.removeProperty("--calendar-detail-media-height");
    }
    state.detailOpen = false;

    var dateModal = document.getElementById("calendar-date-modal");
    if (!dateModal || dateModal.hidden) {
      document.body.classList.remove("modal-open");
    }
  }

  function bindEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;

    document.addEventListener("click", function (event) {
      if (document.body && document.body.dataset.page !== "calendar") return;

      var calendarGrid = document.getElementById("calendar-grid");
      if (calendarGrid && calendarGrid.contains(event.target)) {
        var day = event.target.closest(".calendar-day[data-date-key]");
        if (!day || day.disabled) return;

        event.preventDefault();
        openDateModal(String(day.dataset.dateKey || ""));
        return;
      }

      var dateGrid = document.getElementById("calendar-date-grid");
      if (dateGrid && dateGrid.contains(event.target)) {
        var card = event.target.closest(".calendar-modal-card");
        if (!card) return;

        event.preventDefault();
        var index = Number(card.dataset.itemIndex);
        var item = state.activeDateItems[index];
        if (item) {
          openDetailModal(item);
        }
        return;
      }

      var dateModal = document.getElementById("calendar-date-modal");
      if (dateModal && !dateModal.hidden) {
        if (event.target === dateModal || event.target.closest("#calendar-date-modal [data-modal-dismiss]")) {
          event.preventDefault();
          closeDateModal();
          return;
        }
      }

      var detailModal = document.getElementById("calendar-detail-modal");
      if (detailModal && !detailModal.hidden) {
        if (event.target === detailModal || event.target.closest("#calendar-detail-modal [data-modal-dismiss]")) {
          event.preventDefault();
          closeDetailModal();
        }
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;

      var detailModal = document.getElementById("calendar-detail-modal");
      if (detailModal && !detailModal.hidden) {
        closeDetailModal();
        return;
      }

      var dateModal = document.getElementById("calendar-date-modal");
      if (dateModal && !dateModal.hidden) {
        closeDateModal();
      }
    });

    window.addEventListener("resize", syncDetailModalHeight);
  }

  async function initCalendarPage() {
    if (state.initInFlight) return state.initInFlight;

    state.initInFlight = (async function () {
      bindEvents();

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

      closeDetailModal();
      closeDateModal();
      cleanupPreviewTimers();
      disconnectScrollObserver();

      state.entries = await window.loadTactGalleryData();
      state.dayMap = flattenEntries(state.entries);
      renderCalendar();
    })().finally(function () {
      state.initInFlight = null;
    });

    return state.initInFlight;
  }

  function bootCalendarPage() {
    if (document.body && document.body.dataset.page === "calendar") {
      initCalendarPage();
    }
  }

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initCalendarPage = initCalendarPage;
  window.initCalendarPage = initCalendarPage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCalendarPage, { once: true });
  } else {
    bootCalendarPage();
  }
})();
