(function () {
  var state = {
    items: [],
    itemsById: {},
    rendered: 0,
    batchSize: 12,
    observer: null,
    modalOpen: false,
    activeModalItemId: "",
    initInFlight: null,
    eventsBound: false
  };

  function flattenEntries(entries) {
    var output = [];
    entries.forEach(function (entry) {
      entry.images.forEach(function (image, index) {
        output.push({
          id: entry.slug + "-" + index,
          slug: entry.slug,
          eventSlug: entry.eventSlug || entry.slug,
          program: entry.program || "",
          title: entry.title,
          date: entry.date,
          location: entry.location,
          description: image.description,
          previewDescription: image.description,
          url: image.url
        });
      });
    });

    output.sort(function (left, right) {
      return String(right.date || "").localeCompare(String(left.date || ""));
    });

    return output;
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

  function stripMarkdown(text) {
    return String(text || "")
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .trim();
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

  var layoutPending = false;

  function layoutGallery() {
    var grid = document.getElementById("gallery-grid");
    if (!grid) return;

    var containerWidth = grid.getBoundingClientRect().width;
    if (!(containerWidth > 0)) return;

    var H = 260;  // every image in every row is exactly this many pixels tall
    var GAP = 10;

    var cards = Array.from(grid.querySelectorAll(".gallery-card"));
    if (!cards.length) return;

    var items = cards.map(function (card) {
      var img = card.querySelector(".gallery-card-image");
      var ratio = (img && img.naturalWidth && img.naturalHeight)
        ? img.naturalWidth / img.naturalHeight
        : 4 / 3;
      return { card: card, ratio: ratio };
    });

    // Pack images into rows at fixed height H.
    // When adding the next image would overflow, compare both choices:
    //   include → compress (scale < 1)   vs   exclude → stretch (scale > 1)
    // Pick whichever scale deviates less from 1.0, minimises visible distortion.
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

    // Apply: H px tall for every card, widths scaled to fill containerWidth.
    // Last (partial) row: natural widths, left-aligned, no gross stretching.
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
        item.card.style.flex = "0 0 " + w + "px";
        item.card.style.width = w + "px";
        item.card.style.height = H + "px";
      });
    });
  }

  function scheduleLayout() {
    if (layoutPending) return;
    layoutPending = true;
    requestAnimationFrame(function () {
      layoutPending = false;
      layoutGallery();
    });
  }

  function buildGalleryCard(item) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-card";
    button.setAttribute("aria-label", item.title + " on " + formatDate(item.date));
    button.dataset.itemId = item.id;

    var image = document.createElement("img");
    image.className = "gallery-card-image";
    image.src = item.url;
    image.alt = item.title;
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("load", scheduleLayout);

    var overlay = document.createElement("span");
    overlay.className = "gallery-card-overlay";
    overlay.innerHTML =
      "<strong>" + escapeHtml(item.title) + "</strong>" +
      "<span>" + escapeHtml(formatDate(item.date)) + "</span>" +
      "<span>" + escapeHtml(item.location) + "</span>" +
      "<span>" + escapeHtml(shortText(stripMarkdown(item.previewDescription || item.description), 120)) + "</span>";

    button.appendChild(image);
    button.appendChild(overlay);
    return button;
  }

  function renderNextBatch() {
    var grid = document.getElementById("gallery-grid");
    var empty = document.getElementById("gallery-empty");
    var sentinel = document.getElementById("gallery-sentinel");
    if (!grid || !empty) return;

    if (!state.items.length) {
      empty.hidden = false;
      if (sentinel) sentinel.hidden = true;
      return;
    }

    empty.hidden = true;
    state.items.slice(state.rendered, state.rendered + state.batchSize).forEach(function (item) {
      grid.appendChild(buildGalleryCard(item));
    });
    state.rendered = Math.min(state.items.length, state.rendered + state.batchSize);
    scheduleLayout();

    if (sentinel) {
      sentinel.hidden = state.rendered >= state.items.length;
    }
  }

  function resetGrid() {
    var grid = document.getElementById("gallery-grid");
    var empty = document.getElementById("gallery-empty");
    var sentinel = document.getElementById("gallery-sentinel");

    if (grid) grid.innerHTML = "";
    if (empty) empty.hidden = true;
    if (sentinel) sentinel.hidden = true;

    state.rendered = 0;
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }

  function setupObserver() {
    var sentinel = document.getElementById("gallery-sentinel");
    if (!sentinel) return;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (!window.IntersectionObserver) {
      renderNextBatch();
      return;
    }

    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          renderNextBatch();
        }
      });
    }, { rootMargin: "320px 0px" });

    state.observer.observe(sentinel);
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

  function fallbackModalDescription(item) {
    return String(item.fullDescription || item.eventDescription || "").trim() || "Loading event description";
  }

  async function hydrateModalDescription(item) {
    if (!item) return "";
    if (item.fullDescription) return item.fullDescription;
    if (typeof window.loadTactEventDescription !== "function") return "";

    var description = await window.loadTactEventDescription(item);
    if (description) {
      item.fullDescription = description;
    }
    return description;
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
    document.getElementById("gallery-modal-location").textContent = item.location;
    if (description) description.innerHTML = renderMarkdown(fallbackModalDescription(item));
    dialog.style.setProperty("--gallery-modal-media-height", "90vh");

    modal.hidden = false;
    document.body.classList.add("modal-open");
    state.modalOpen = true;
    syncModalHeight();

    hydrateModalDescription(item).then(function (fullDescription) {
      if (!state.modalOpen || state.activeModalItemId !== item.id || !description) return;
      description.innerHTML = renderMarkdown(fullDescription || item.description || "");
      syncModalHeight();
    });
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
      if (document.body && document.body.dataset.page !== "gallery") return;

      var grid = document.getElementById("gallery-grid");
      if (grid && grid.contains(event.target)) {
        var card = event.target.closest(".gallery-card");
        if (!card) return;

        event.preventDefault();
        var item = state.itemsById[String(card.dataset.itemId || "")];
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
    window.addEventListener("resize", scheduleLayout);
  }

  var PROGRAM_NAMES = {
    harate: "Vijnana Harate",
    aranya: "Vijnana Aranya",
    yuvati: "Vijnana Yuvati",
    nataka: "Vijnana Nataka",
    mela:   "Ganitha Mela"
  };

  function readProgramFilter() {
    var hash = window.location.hash || "";
    var m = hash.match(/(?:^#|&)program=([a-z]+)/);
    return m ? m[1] : "";
  }

  function renderFilterBanner(filterTag) {
    var shell = document.querySelector(".gallery-grid-shell");
    var existing = document.getElementById("gallery-filter-banner");
    if (existing) existing.remove();

    if (!filterTag || !shell) return;

    var programName = PROGRAM_NAMES[filterTag] || filterTag;
    var banner = document.createElement("div");
    banner.id = "gallery-filter-banner";
    banner.className = "gallery-filter-banner";
    banner.innerHTML =
      '<span class="gallery-filter-label">Filtered: <strong>' +
      escapeHtml(programName) +
      "</strong></span>" +
      '<a href="gallery.html" class="gallery-filter-clear">Show all</a>';

    var head = shell.querySelector(".gallery-grid-head");
    if (head && head.nextSibling) {
      shell.insertBefore(banner, head.nextSibling);
    } else {
      shell.insertBefore(banner, shell.firstChild);
    }
  }

  async function initGalleryPage() {
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

      resetGrid();
      closeModal();

      var filterTag = readProgramFilter();
      renderFilterBanner(filterTag);

      var entries = await window.loadTactGalleryData();
      var allItems = flattenEntries(entries);

      if (filterTag) {
        allItems = allItems.filter(function (item) {
          return item.program === filterTag;
        });
      }

      state.items = allItems;
      state.itemsById = {};
      state.items.forEach(function (item) {
        state.itemsById[item.id] = item;
      });

      renderNextBatch();
      setupObserver();
    })().finally(function () {
      state.initInFlight = null;
    });

    return state.initInFlight;
  }

  function bootGalleryPage() {
    if (document.body && document.body.dataset.page === "gallery") {
      initGalleryPage();
      window.addEventListener("hashchange", function () {
        window.location.reload();
      });
    }
  }

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initGalleryPage = initGalleryPage;
  window.initGalleryPage = initGalleryPage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGalleryPage, { once: true });
  } else {
    bootGalleryPage();
  }
})();
