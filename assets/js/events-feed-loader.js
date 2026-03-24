(function () {
  var cache = null;
  var inFlight = null;
  var STORAGE_KEY = "tact-event-feed-cache-v2";

  function localFeed() {
    return Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  function canUseSessionStorage() {
    try {
      return !!window.sessionStorage;
    } catch (_error) {
      return false;
    }
  }

  function shouldUseLocalFeedOnly() {
    var host = window.location && window.location.hostname;
    var protocol = window.location && window.location.protocol;
    return protocol === "file:" || host === "localhost" || host === "127.0.0.1";
  }

  function normalizeStatus(value) {
    var status = String(value || "scheduled").toLowerCase();
    return status === "completed" ? "completed" : "scheduled";
  }

  function normalizeDate(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    var parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      var y = parsed.getFullYear();
      var m = String(parsed.getMonth() + 1).padStart(2, "0");
      var d = String(parsed.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }

    return raw;
  }

  function toPublicPosterUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    // Convert common Drive share links to a thumbnail URL that is more reliable in <img>.
    var match = raw.match(/[?&]id=([^&]+)/i) || raw.match(/\/d\/([^/]+)/i);
    if (raw.indexOf("drive.google.com") >= 0 && match && match[1]) {
      return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1600";
    }

    return raw;
  }

  function normalizeEvent(raw) {
    var pageSlug = String((raw.date || "") + "--" + (raw.title || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return {
      slug: String(raw.slug || ""),
      title: String(raw.title || ""),
      date: normalizeDate(raw.date),
      time: String(raw.time || ""),
      location: String(raw.location || ""),
      teaser: String(raw.teaser || ""),
      homepageMatter: String(raw.homepageMatter || ""),
      status: normalizeStatus(raw.status),
      poster: toPublicPosterUrl(raw.posterUrl || raw.poster || raw.image || ""),
      pageUrl: String(raw.pageUrl || raw.page_url || ("events/" + (pageSlug || String(raw.slug || "")) + ".html"))
    };
  }

  function readStoredFeed() {
    if (!canUseSessionStorage()) return [];

    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      var rows = Array.isArray(parsed && parsed.events) ? parsed.events : [];
      return rows.map(normalizeEvent).filter(function (event) {
        return event.title && event.date;
      });
    } catch (_error) {
      return [];
    }
  }

  function writeStoredFeed(events) {
    if (!canUseSessionStorage()) return;

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          storedAt: Date.now(),
          events: events
        })
      );
    } catch (_error) {
      // Ignore storage quota and privacy-mode failures.
    }
  }

  function clearStoredFeed() {
    if (!canUseSessionStorage()) return;

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Ignore storage and privacy-mode failures.
    }
  }

  function indexBySlug(items) {
    var map = {};
    items.forEach(function (item) {
      if (!item.slug) return;
      map[item.slug] = item;
    });
    return map;
  }

  function mergeWithFallback(remoteItems, fallbackMap) {
    return remoteItems.map(function (item) {
      var fallback = fallbackMap[item.slug];
      if (!fallback) return item;

      return {
        slug: item.slug || fallback.slug,
        title: item.title || fallback.title,
        date: item.date || fallback.date,
        time: item.time || fallback.time,
        location: item.location || fallback.location,
        teaser: item.teaser || fallback.teaser,
        homepageMatter: item.homepageMatter || fallback.homepageMatter,
        status: item.status || fallback.status,
        poster: fallback.poster || item.poster,
        pageUrl: item.pageUrl || fallback.pageUrl
      };
    });
  }

  function withTimeout(url, timeoutMs) {
    if (!window.AbortController) {
      return fetch(url, { method: "GET", cache: "no-store" });
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  async function fetchRemoteFeed(endpoint, timeoutMs) {
    var separator = endpoint.indexOf("?") >= 0 ? "&" : "?";
    var url = endpoint + separator + "mode=feed";
    var response = await withTimeout(url, timeoutMs);
    if (!response.ok) {
      throw new Error("Feed request failed with " + response.status);
    }

    var payload = await response.json();
    var rows = Array.isArray(payload && payload.events) ? payload.events : [];
    return rows.map(normalizeEvent).filter(function (event) {
      return event.title && event.date;
    });
  }

  function getBaseFeed(endpoint) {
    var base = localFeed().map(normalizeEvent);
    var fallbackMap = indexBySlug(base);

    if (!endpoint || shouldUseLocalFeedOnly()) {
      cache = base;
      clearStoredFeed();
      return {
        base: base,
        fallbackMap: fallbackMap,
        initial: cache.slice()
      };
    }

    var stored = readStoredFeed();
    if (stored.length) {
      cache = mergeWithFallback(stored, fallbackMap);
      return {
        base: base,
        fallbackMap: fallbackMap,
        initial: cache.slice()
      };
    }

    cache = base;
    return {
      base: base,
      fallbackMap: fallbackMap,
      initial: cache.slice()
    };
  }

  window.getTactEventFeedSnapshot = function () {
    if (cache) return cache.slice();
    var config = window.TACT_EVENTS_CONFIG || {};
    var endpoint = String(config.apiEndpoint || "").trim();
    return getBaseFeed(endpoint).initial;
  };

  window.loadTactEventFeed = async function (options) {
    var settings = options || {};
    var forceRefresh = settings.forceRefresh === true;

    if (cache && !forceRefresh) return cache.slice();
    if (inFlight && !forceRefresh) return inFlight;

    var config = window.TACT_EVENTS_CONFIG || {};
    var endpoint = String(config.apiEndpoint || "").trim();
    var timeoutMs = Number(config.requestTimeoutMs || 10000);
    var state = getBaseFeed(endpoint);

    if (!endpoint || shouldUseLocalFeedOnly()) {
      return cache.slice();
    }

    inFlight = fetchRemoteFeed(endpoint, timeoutMs)
      .then(function (remote) {
        cache = remote.length ? mergeWithFallback(remote, state.fallbackMap) : state.base;
        writeStoredFeed(cache);
        return cache.slice();
      })
      .catch(function () {
        return cache.slice();
      })
      .finally(function () {
        inFlight = null;
      });

    return inFlight;
  };
})();
