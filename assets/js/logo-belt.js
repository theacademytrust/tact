(function () {
  var state = {
    track: null,
    viewport: null,
    distance: 0,
    offset: 0,
    isDragging: false,
    isHovering: false,
    dragStartX: 0,
    dragStartOffset: 0,
    hasDragged: false,
    rafId: null,
    lastTs: null,
    pps: 62,          /* pixels per second auto-scroll speed */
    originalCount: 0,
    resizeHandler: null
  };

  /* ── init / teardown ───────────────────────────────────────── */

  function initLogoBelt() {
    teardownLogoBelt();

    var root = document.getElementById("logo-belt-root");
    if (!root) return;

    var logos = Array.isArray(window.TACT_LOGO_BELT) ? window.TACT_LOGO_BELT.slice() : [];
    root.innerHTML = "";

    if (!logos.length) {
      root.innerHTML = '<p class="logo-belt-empty">Partner and collaborator marks will appear here.</p>';
      return;
    }

    var reducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var track = document.createElement("div");
    track.className = "logo-belt-track";
    state.track = track;
    state.viewport = root;
    state.originalCount = logos.length;

    /* Build original set + one duplicate set for seamless looping */
    var repeated = !reducedMotion && logos.length > 2 ? logos.concat(logos) : logos;
    repeated.forEach(function (item, index) {
      track.appendChild(buildLogoCard(item, index >= logos.length));
    });

    root.appendChild(track);

    if (!reducedMotion && logos.length > 2) {
      setupDrag(root);
      setupHover(root);

      /* First measure — after layout but images may still be loading */
      requestAnimationFrame(function () {
        measureDistance();
        startAnimation();

        /* Re-measure once images have had time to load and reflow */
        setTimeout(function () { measureDistance(); }, 400);
        setTimeout(function () { measureDistance(); }, 1200);
      });

      /* Also re-measure on each image load in the original set */
      var origItems = track.querySelectorAll(".logo-belt-item:not([aria-hidden]) img");
      origItems.forEach(function (img) {
        if (!img.complete) {
          img.addEventListener("load", function () { measureDistance(); }, { once: true });
        }
      });

      state.resizeHandler = function () { measureDistance(); };
      window.addEventListener("resize", state.resizeHandler);
    }
  }

  function teardownLogoBelt() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
      state.resizeHandler = null;
    }
    state.track = null;
    state.viewport = null;
    state.distance = 0;
    state.offset = 0;
    state.isDragging = false;
    state.isHovering = false;
    state.lastTs = null;
    state.originalCount = 0;
  }

  /* ── distance measurement ──────────────────────────────────── */

  function measureDistance() {
    var track = state.track;
    var n = state.originalCount;
    if (!track || !n) return;

    var items = track.children;
    if (!items.length || items.length < n) return;

    var first = items[0];
    var lastOrig = items[n - 1];
    if (!first || !lastOrig) return;

    var dist = (lastOrig.offsetLeft + lastOrig.offsetWidth) - first.offsetLeft;
    if (dist > 40) {
      /* Wrap current offset so it stays in range after re-measure */
      if (state.offset >= dist) state.offset = state.offset % dist;
      state.distance = dist;
    }
  }

  /* ── RAF animation ─────────────────────────────────────────── */

  function startAnimation() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.lastTs = null;

    function tick(ts) {
      if (!state.rafId) return;   /* stopped by teardown */

      if (!state.isDragging && !state.isHovering && state.distance) {
        if (state.lastTs !== null) {
          var delta = ts - state.lastTs;
          state.offset += (state.pps * delta) / 1000;
          if (state.offset >= state.distance) state.offset -= state.distance;
          applyTransform();
        }
        state.lastTs = ts;
      } else {
        /* Reset so there's no time-jump after a pause */
        state.lastTs = null;
      }

      state.rafId = requestAnimationFrame(tick);
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function applyTransform() {
    if (state.track) {
      state.track.style.transform = "translateX(" + (-state.offset).toFixed(2) + "px)";
    }
  }

  /* ── drag (pointer events: mouse + touch + pen) ────────────── */

  function setupDrag(viewport) {
    viewport.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.isDragging = true;
      state.hasDragged = false;
      state.dragStartX = e.clientX;
      state.dragStartOffset = state.offset;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add("is-dragging");
      e.preventDefault();
    });

    viewport.addEventListener("pointermove", function (e) {
      if (!state.isDragging) return;
      var delta = state.dragStartX - e.clientX;
      if (Math.abs(delta) > 4) state.hasDragged = true;
      if (state.distance) {
        var raw = state.dragStartOffset + delta;
        state.offset = ((raw % state.distance) + state.distance) % state.distance;
        applyTransform();
      }
      e.preventDefault();
    }, { passive: false });

    function endDrag() {
      if (!state.isDragging) return;
      state.isDragging = false;
      viewport.classList.remove("is-dragging");
    }

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    /* Suppress click after a real drag to avoid accidental activation */
    viewport.addEventListener("click", function (e) {
      if (state.hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        state.hasDragged = false;
      }
    }, true);
  }

  /* ── hover pause ───────────────────────────────────────────── */

  function setupHover(viewport) {
    viewport.addEventListener("mouseenter", function () { state.isHovering = true; });
    viewport.addEventListener("mouseleave", function () { state.isHovering = false; });
  }

  /* ── card builder ──────────────────────────────────────────── */

  function buildLogoCard(item, isDuplicate) {
    var card = document.createElement("div");
    card.className = "logo-belt-item";
    if (isDuplicate) card.setAttribute("aria-hidden", "true");

    var label = cleanLabel(item && item.name);
    var src = String((item && item.src) || "").trim();

    /* Fixed-height wrapper keeps all labels at the same baseline */
    var wrap = document.createElement("div");
    wrap.className = "logo-belt-img-wrap";

    var img = document.createElement("img");
    img.src = src;
    img.alt = label ? label + " logo" : "Partner logo";
    img.loading = "eager";   /* load immediately — needed for distance measurement */
    img.decoding = "async";
    img.draggable = false;
    wrap.appendChild(img);
    card.appendChild(wrap);

    if (label) {
      var lbl = document.createElement("span");
      lbl.className = "logo-belt-label";
      lbl.textContent = label;
      if (isDuplicate) lbl.setAttribute("aria-hidden", "true");
      card.appendChild(lbl);
    }

    return card;
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ── boot ──────────────────────────────────────────────────── */

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initLogoBelt = initLogoBelt;
  window.TACT_PAGE_RUNTIME.teardownLogoBelt = teardownLogoBelt;

  if (document.getElementById("logo-belt-root")) {
    initLogoBelt();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("logo-belt-root")) {
        initLogoBelt();
      }
    }, { once: true });
  }
})();
