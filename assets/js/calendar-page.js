(function () {
  var state = {
    entries: [],
    dayMap: {},
    currentMonth: startOfMonth(new Date()),
    previewTimers: [],
    activeDateItems: [],
    detailOpen: false,
    initInFlight: null,
    eventsBound: false
  };

  function startOfMonth(value) {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  function parseDate(value) {
    var parsed = new Date(String(value || "") + "T00:00:00");
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatMonth(value) {
    return value.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
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

  function buildDayCell(dayNumber, isCurrentMonth, dateKey, items) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day" + (isCurrentMonth ? "" : " is-outside") + (items.length ? " has-gallery" : "");
    button.disabled = !isCurrentMonth || !items.length;
    if (dateKey) button.dataset.dateKey = dateKey;

    var dayLabel = document.createElement("span");
    dayLabel.className = "calendar-day-number";
    dayLabel.textContent = isCurrentMonth ? String(dayNumber) : "";
    button.appendChild(dayLabel);

    if (!items.length) {
      return button;
    }

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
    count.textContent = items.length + " image" + (items.length === 1 ? "" : "s");
    button.appendChild(count);

    return button;
  }

  function renderCalendar() {
    cleanupPreviewTimers();

    var label = document.getElementById("calendar-month-label");
    var grid = document.getElementById("calendar-grid");
    if (!label || !grid) return;

    label.textContent = formatMonth(state.currentMonth);
    grid.innerHTML = "";

    var year = state.currentMonth.getFullYear();
    var month = state.currentMonth.getMonth();
    var firstDay = new Date(year, month, 1);
    var totalDays = new Date(year, month + 1, 0).getDate();
    var offset = firstDay.getDay();
    var totalSlots = Math.ceil((offset + totalDays) / 7) * 7;

    for (var i = 0; i < totalSlots; i++) {
      var dayNumber = i - offset + 1;
      var isCurrentMonth = dayNumber >= 1 && dayNumber <= totalDays;
      var dateKey = isCurrentMonth
        ? [
            year,
            String(month + 1).padStart(2, "0"),
            String(dayNumber).padStart(2, "0")
          ].join("-")
        : "";
      var items = dateKey ? state.dayMap[dateKey] || [] : [];
      grid.appendChild(buildDayCell(dayNumber, isCurrentMonth, dateKey, items));
    }
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

      var prev = event.target.closest("#calendar-prev-btn");
      if (prev) {
        event.preventDefault();
        state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
        renderCalendar();
        return;
      }

      var next = event.target.closest("#calendar-next-btn");
      if (next) {
        event.preventDefault();
        state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
        renderCalendar();
        return;
      }

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
