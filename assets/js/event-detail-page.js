(function () {
  var state = {
    modalOpen: false,
    activeModalItemId: "",
    itemsById: {},
    eventsBound: false
  };

  function getSiteRoot() {
    var root = document.body && document.body.dataset ? document.body.dataset.siteRoot : "";
    root = String(root || "").trim();
    return root ? root.replace(/\/?$/, "/") : "";
  }

  function resolveSitePath(path) {
    var raw = String(path || "").trim();
    if (!raw) return "";
    if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.indexOf("data:") === 0 || raw.indexOf("../") === 0 || raw.indexOf("./") === 0) {
      return raw;
    }
    return getSiteRoot() + raw.replace(/^\/+/, "");
  }

  function formatDate(value) {
    var parsed = new Date(String(value || "") + "T00:00:00");
    if (isNaN(parsed.getTime())) return value || "";
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdown(text) {
    if (!text) return "";
    return String(text).split("\n").map(function (line) {
      var m = line.match(/^(#+)\s+(.*)/);
      if (m) {
        var content = escapeHtml(m[2]).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        return '<span class="md-heading">' + content + "</span>";
      }
      return escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    }).join("\n");
  }

  function shortText(value, limit) {
    var text = String(value || "").trim();
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
  }

  // Returns "" for null/empty/TBA/TBD/unknown/N/A — never show these as labels
  function cleanMeta(value) {
    if (value === null || value === undefined) return "";
    var s = String(value).trim();
    if (!s) return "";
    var lower = s.toLowerCase();
    if (lower === "tba" || lower === "tbd" || lower === "unknown" || lower === "n/a" || lower === "na") return "";
    return s;
  }

  // Strips junk tokens ("Unknown Session", embedded dates, times) then title-cases
  function displayTitle(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";

    text = text.replace(/\bunknown\s+session\b/gi, "");
    text = text.replace(/\bunknown\b/gi, "");
    text = text.replace(/\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi, "");
    text = text.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "");
    text = text.replace(/\s+/g, " ").replace(/[\s,;:\-–—]+$/g, "").trim();
    if (!text) return "";

    var lower = text.toLowerCase();
    var smallWords = { a: true, an: true, and: true, at: true, for: true, in: true, of: true, on: true, the: true, to: true, with: true };
    var acronyms = { aps: "APS", bel: "BEL", bits: "BITS", dav: "DAV", dst: "DST", iasc: "IASc", ias: "IAS", iisc: "IISc", iiser: "IISER", iiet: "IIET", iit: "IIT", igntu: "IGNTU", isro: "ISRO", jncasr: "JNCASR", mcb: "MCB", mcc: "MCC", mes: "MES", ncert: "NCERT", niser: "NISER", nit: "NIT", om: "OM", rri: "RRI", soafal: "SOAFAL", srm: "SRM", stem: "STEM", tact: "tAcT", vitm: "VITM" };

    return lower.split(" ").map(function (word, index) {
      return word.split("-").map(function (part, partIndex) {
        if (acronyms[part]) return acronyms[part];
        if (index > 0 && smallWords[part]) return part;
        if (partIndex > 0 && smallWords[part]) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join("-");
    }).join(" ");
  }

  // Infers a human-readable program name from slug/title when title is empty
  function programLabel(item) {
    var source = String((item && item.slug || "") + " " + (item && item.title || "")).toLowerCase();
    if (source.indexOf("soafal") >= 0) return "SOAFAL";
    if (source.indexOf("vijnana-harate") >= 0 || source.indexOf("vijnana harate") >= 0) return "Vijnana Harate";
    if (source.indexOf("vijnana-aranya") >= 0 || source.indexOf("vijnana aranya") >= 0) return "Vijnana Aranya";
    if (source.indexOf("vijnana-yuvati") >= 0 || source.indexOf("vijnana yuvati") >= 0) return "Vijnana Yuvati";
    if (source.indexOf("vijnana-nataka") >= 0 || source.indexOf("vijnana nataka") >= 0) return "Vijnana Nataka";
    if (source.indexOf("ganitha") >= 0) return "Ganitha Mela";
    if (source.indexOf("science") >= 0) return "Science Outreach";
    if (source.indexOf("mathematics") >= 0) return "Mathematics";
    return "tAcT Event";
  }

  function getEventSlug() {
    if (document.body && document.body.dataset && document.body.dataset.eventSlug) {
      return String(document.body.dataset.eventSlug || "").trim();
    }
    var pathname = window.location && window.location.pathname ? window.location.pathname : "";
    var filename = pathname.split("/").pop() || "";
    return filename.replace(/\.html$/i, "");
  }

  function getEventFeedItem(slug) {
    var feed = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED : [];
    for (var i = 0; i < feed.length; i++) {
      if (String(feed[i].slug || "") === slug) return feed[i];
    }
    return null;
  }

  function sameDay(left, right) {
    return String(left || "").trim() === String(right || "").trim();
  }

  function sameText(left, right) {
    return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
  }

  function findGalleryEntry(eventItem, galleries) {
    var list = Array.isArray(galleries) ? galleries : [];
    var slug = String(eventItem && eventItem.slug || "");
    var title = String(eventItem && eventItem.title || "");
    var date = String(eventItem && eventItem.date || "");

    for (var i = 0; i < list.length; i++) {
      var entry = list[i] || {};
      if (String(entry.eventSlug || entry.slug || "") === slug) {
        return entry;
      }
    }

    for (var j = 0; j < list.length; j++) {
      var byMeta = list[j] || {};
      if (sameDay(byMeta.date, date) && sameText(byMeta.title, title)) {
        return byMeta;
      }
    }

    return null;
  }

  async function loadFullEventDescription(eventItem) {
    if (typeof window.loadTactEventDescription === "function") {
      var description = await window.loadTactEventDescription(eventItem);
      if (description) return description;
    }

    return String(eventItem.homepageMatter || eventItem.teaser || "").trim();
  }

  function buildGalleryItem(eventItem, image, index, fullDescription) {
    return {
      id: "gallery-" + index,
      title: displayTitle(eventItem.title) || programLabel(eventItem),
      date: String(eventItem.date || ""),
      location: cleanMeta(eventItem.location),
      description: String(fullDescription || (image && image.description) || ""),
      previewDescription: String((image && image.description) || ""),
      url: String((image && image.url) || "")
    };
  }

  function buildPosterItem(eventItem, fullDescription) {
    return {
      id: "poster",
      title: displayTitle(eventItem.title) || programLabel(eventItem),
      date: String(eventItem.date || ""),
      location: cleanMeta(eventItem.location),
      description: String(fullDescription || eventItem.homepageMatter || eventItem.teaser || ""),
      previewDescription: String(eventItem.homepageMatter || eventItem.teaser || ""),
      url: resolveSitePath(String(eventItem.poster || ""))
    };
  }

  function buildGalleryCard(item) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-card";
    button.dataset.itemId = item.id;
    button.setAttribute("aria-label", item.title + " on " + formatDate(item.date));

    var image = document.createElement("img");
    image.className = "gallery-card-image";
    image.src = item.url;
    image.alt = item.title;
    image.loading = "lazy";
    image.decoding = "async";

    var overlay = document.createElement("span");
    overlay.className = "gallery-card-overlay";
    overlay.innerHTML =
      "<strong>" + escapeHtml(item.title) + "</strong>" +
      "<span>" + escapeHtml(formatDate(item.date)) + "</span>" +
      "<span>" + escapeHtml(item.location) + "</span>" +
      "<span>" + escapeHtml(shortText(item.previewDescription || item.description, 120)) + "</span>";

    button.appendChild(image);
    button.appendChild(overlay);
    return button;
  }

  function syncModalHeight() {
    if (!state.modalOpen) return;

    var dialog = document.querySelector("#gallery-modal .gallery-modal-dialog");
    var image = document.getElementById("gallery-modal-image");
    if (!dialog || !image) return;

    var apply = function () {
      var rect = image.getBoundingClientRect();
      var nextHeight = Math.max(240, Math.round(rect.height || 0));
      dialog.style.setProperty("--gallery-modal-media-height", nextHeight + "px");
    };

    if (image.complete) {
      window.requestAnimationFrame(apply);
      return;
    }

    image.onload = apply;
  }

  function modalDescriptionFor(item) {
    return String(item.fullDescription || item.description || "").trim();
  }

  function openModal(item) {
    var modal = document.getElementById("gallery-modal");
    var dialog = modal ? modal.querySelector(".gallery-modal-dialog") : null;
    var image = document.getElementById("gallery-modal-image");
    var description = document.getElementById("gallery-modal-description");
    if (!modal || !dialog || !image || !item) return;

    state.activeModalItemId = item.id;
    image.src = item.url;
    image.alt = item.title;
    document.getElementById("gallery-modal-title").textContent = item.title;
    document.getElementById("gallery-modal-date").textContent = formatDate(item.date);
    var locationEl = document.getElementById("gallery-modal-location");
    if (locationEl) {
      locationEl.textContent = item.location;
      locationEl.hidden = !item.location;
    }
    if (description) description.innerHTML = renderMarkdown(modalDescriptionFor(item));
    dialog.style.setProperty("--gallery-modal-media-height", "90vh");

    modal.hidden = false;
    document.body.classList.add("modal-open");
    state.modalOpen = true;
    syncModalHeight();
  }

  function closeModal() {
    var modal = document.getElementById("gallery-modal");
    var dialog = modal ? modal.querySelector(".gallery-modal-dialog") : null;
    if (!modal) return;

    modal.hidden = true;
    if (dialog) {
      dialog.style.removeProperty("--gallery-modal-media-height");
    }
    document.body.classList.remove("modal-open");
    state.modalOpen = false;
    state.activeModalItemId = "";
  }

  function bindEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;

    document.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-item-id]");
      if (trigger) {
        event.preventDefault();
        var item = state.itemsById[String(trigger.dataset.itemId || "")];
        if (item) {
          openModal(item);
        }
        return;
      }

      var modal = document.getElementById("gallery-modal");
      if (modal && !modal.hidden) {
        if (event.target === modal || event.target.closest("[data-modal-dismiss]")) {
          event.preventDefault();
          closeModal();
        }
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.modalOpen) {
        closeModal();
      }
    });

    window.addEventListener("resize", syncModalHeight);
  }

  function renderError(message) {
    var main = document.getElementById("main");
    if (!main) return;

    main.innerHTML =
      '<section class="surface"><p class="event-detail-error">' +
      escapeHtml(message || "Could not load this event.") +
      "</p></section>";
  }

  function renderEventDetail(eventItem, galleryEntry, fullDescription) {
    var main = document.getElementById("main");
    if (!main || !eventItem) return;

    var titleText = displayTitle(eventItem.title) || programLabel(eventItem);
    var timeText  = cleanMeta(eventItem.time);
    var locText   = cleanMeta(eventItem.location);

    document.title = titleText + " - The Academy Trust (tAcT)";

    var images = galleryEntry && Array.isArray(galleryEntry.images) ? galleryEntry.images : [];
    var gallerySection = images.length > 1
      ? (
        '<section class="surface event-detail-gallery-shell">' +
          '<div class="event-detail-gallery-head">' +
            "<h2>Gallery</h2>" +
            "<p>Moments captured from this event.</p>" +
          "</div>" +
          '<div id="gallery-grid" class="gallery-grid"></div>' +
        "</section>"
      )
      : "";

    var timeSpan = timeText
      ? "<span>" + escapeHtml(timeText) + "</span>"
      : "";
    var locSpan = locText
      ? "<span>" + escapeHtml(locText) + "</span>"
      : "";

    main.innerHTML =
      '<div class="event-detail-shell">' +
        '<section class="surface event-detail-hero">' +
          '<button type="button" class="event-detail-poster-card" data-item-id="poster" aria-label="Open poster for ' + escapeHtml(titleText) + '">' +
            '<img src="' + escapeHtml(resolveSitePath(eventItem.poster || "assets/images/tact-logo.jpg")) + '" alt="' + escapeHtml(titleText) + '">' +
          "</button>" +
          '<div class="event-detail-copy">' +
            "<h1>" + escapeHtml(titleText) + "</h1>" +
            '<div class="event-detail-meta">' +
              "<span>" + escapeHtml(formatDate(eventItem.date)) + "</span>" +
              timeSpan +
              locSpan +
            "</div>" +
            '<div class="event-detail-description">' + renderMarkdown(fullDescription || "") + "</div>" +
          "</div>" +
        "</section>" +
        gallerySection +
      "</div>";

    var posterItem = buildPosterItem(eventItem, fullDescription);
    state.itemsById = { poster: posterItem };

    var grid = document.getElementById("gallery-grid");
    if (!images.length || !grid) {
      return;
    }

    images.forEach(function (image, index) {
      var item = buildGalleryItem(eventItem, image, index + 1, fullDescription);
      state.itemsById[item.id] = item;
      grid.appendChild(buildGalleryCard(item));
    });
  }

  async function initEventDetailPage() {
    bindEvents();

    if (window.TACT_CHROME) {
      if (typeof window.TACT_CHROME.ensureHeader === "function") {
        window.TACT_CHROME.ensureHeader();
      } else {
        window.TACT_CHROME.renderHeader();
      }
      if (typeof window.TACT_CHROME.ensureFooter === "function") {
        window.TACT_CHROME.ensureFooter();
      } else if (typeof window.TACT_CHROME.renderFooter === "function") {
        window.TACT_CHROME.renderFooter();
      }
      window.TACT_CHROME.initDropdowns();
    }

    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    var slug = getEventSlug();
    if (!slug) {
      renderError("Missing event page slug.");
      return;
    }

    var eventItem = getEventFeedItem(slug);
    if (!eventItem) {
      renderError("This event page could not find matching event data.");
      return;
    }

    var galleries = [];
    if (typeof window.loadTactGalleryData === "function") {
      galleries = await window.loadTactGalleryData({ forceRefresh: true });
    }

    var galleryEntry = findGalleryEntry(eventItem, galleries);
    var fullDescription = await loadFullEventDescription(eventItem);

    renderEventDetail(eventItem, galleryEntry, fullDescription);
  }

  function boot() {
    if (document.body && document.body.dataset.page === "event-detail") {
      initEventDetailPage();
    }
  }

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initEventDetailPage = initEventDetailPage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
