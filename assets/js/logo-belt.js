(function () {
  var state = {
    resizeHandler: null
  };

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

    var repeated = !reducedMotion && logos.length > 2 ? logos.concat(logos) : logos;
    repeated.forEach(function (item, index) {
      track.appendChild(buildLogoCard(item, index >= logos.length));
    });

    root.appendChild(track);

    if (!reducedMotion && logos.length > 2) {
      applyMeasuredAnimation(track, logos.length);
      state.resizeHandler = function () {
        applyMeasuredAnimation(track, logos.length);
      };
      window.addEventListener("resize", state.resizeHandler);
    }
  }

  function teardownLogoBelt() {
    if (state.resizeHandler) {
      window.removeEventListener("resize", state.resizeHandler);
      state.resizeHandler = null;
    }
  }

  function applyMeasuredAnimation(track, originalCount) {
    if (!track || !originalCount) return;

    track.classList.remove("is-animated");
    track.style.removeProperty("--logo-belt-distance");
    track.style.removeProperty("--logo-belt-duration");

    window.requestAnimationFrame(function () {
      var items = track.children;
      if (!items.length || items.length < originalCount) return;

      var first = items[0];
      var lastOriginal = items[originalCount - 1];
      if (!first || !lastOriginal) return;

      var distance = (lastOriginal.offsetLeft + lastOriginal.offsetWidth) - first.offsetLeft + 14;
      if (!distance || distance < 40) return;

      var pixelsPerSecond = 56;
      var durationSeconds = Math.max(distance / pixelsPerSecond, 18);

      track.style.setProperty("--logo-belt-distance", distance + "px");
      track.style.setProperty("--logo-belt-duration", durationSeconds.toFixed(2) + "s");
      track.classList.add("is-animated");
    });
  }

  function buildLogoCard(item, isDuplicate) {
    var card = document.createElement("div");
    var image = document.createElement("img");
    var label = cleanLabel(item && item.name);
    var src = String(item && item.src || "").trim();
    var isWide = label.length > 16;

    card.className = "logo-belt-item" + (isWide ? " logo-belt-item--wide" : "");
    if (isDuplicate) {
      card.setAttribute("aria-hidden", "true");
    }

    image.src = src;
    image.alt = label ? label + " logo" : "Partner logo";
    image.loading = "lazy";
    image.decoding = "async";

    card.appendChild(image);
    return card;
  }

  function cleanLabel(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

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
