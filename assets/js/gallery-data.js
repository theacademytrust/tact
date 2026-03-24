(function () {
  var cache = null;
  var inFlight = null;
  var DATA_URL = resolveSitePath("data/gallery.json");

  function getSiteRoot() {
    var root = document.body && document.body.dataset ? document.body.dataset.siteRoot : "";
    root = String(root || "").trim();
    return root ? root.replace(/\/?$/, "/") : "";
  }

  function resolveSitePath(path) {
    return getSiteRoot() + String(path || "").replace(/^\/+/, "");
  }

  function normalizeDate(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    var parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return raw;

    var year = parsed.getFullYear();
    var month = String(parsed.getMonth() + 1).padStart(2, "0");
    var day = String(parsed.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function normalizeImage(image) {
    var row = image || {};
    return {
      url: resolveSitePath(String(row.url || row.src || "").trim()),
      description: String(row.description || row.caption || "").trim()
    };
  }

  function normalizeEntry(entry) {
    var row = entry || {};
    var title = String(row.title || "").trim();
    var date = normalizeDate(row.date);
    var location = String(row.location || "").trim();
    var slug = String(row.slug || "").trim();
    var eventSlug = String(row.eventSlug || row.event_slug || slug).trim();
    var helpers = window.TACT_EVENT_PAGES || {};
    var pageUrl = resolveSitePath(
      typeof helpers.buildEventPageUrl === "function"
        ? helpers.buildEventPageUrl({ date: date, title: title, slug: eventSlug || slug })
        : "events/" + String(eventSlug || slug).trim() + ".html"
    );
    var images = (Array.isArray(row.images) ? row.images : [])
      .map(normalizeImage)
      .filter(function (image) {
        return image.url && image.description;
      });

    return {
      slug: slug || [date, title].join("--").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      eventSlug: eventSlug || slug || [date, title].join("--").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      pageUrl: pageUrl,
      title: title,
      date: date,
      location: location,
      images: images
    };
  }

  function parsePayload(payload) {
    var rows = [];
    if (Array.isArray(payload)) {
      rows = payload;
    } else if (payload && Array.isArray(payload.galleries)) {
      rows = payload.galleries;
    } else if (payload && Array.isArray(payload.items)) {
      rows = payload.items;
    }

    return rows.map(normalizeEntry).filter(function (entry) {
      return entry.title && entry.date && entry.location && entry.images.length;
    });
  }

  async function fetchGalleryData() {
    var response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gallery request failed with " + response.status);
    }
    var payload = await response.json();
    return parsePayload(payload);
  }

  window.getTactGallerySnapshot = function () {
    return Array.isArray(cache) ? cache.slice() : [];
  };

  window.loadTactGalleryData = async function (options) {
    var settings = options || {};
    if (cache && !settings.forceRefresh) {
      return cache.slice();
    }
    if (inFlight && !settings.forceRefresh) {
      return inFlight;
    }

    inFlight = fetchGalleryData()
      .then(function (entries) {
        cache = entries;
        return cache.slice();
      })
      .catch(function () {
        cache = [];
        return [];
      })
      .finally(function () {
        inFlight = null;
      });

    return inFlight;
  };
})();
