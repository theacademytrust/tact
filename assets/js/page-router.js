(function () {
  var ROUTE_SCRIPTS = {
    "index.html": [
      "assets/js/events-config.js",
      "content/events/events-feed.js?v=20260501c",
      "assets/js/event-page-paths.js",
      "assets/js/events-feed-loader.js",
      "assets/js/gallery-data.js?v=20260501c",
      "assets/js/home-events-board.js",
      "assets/js/index-page.js"
    ],
    "events.html": [
      "assets/js/events-config.js",
      "content/events/events-feed.js?v=20260501c",
      "assets/js/event-page-paths.js",
      "assets/js/events-feed-loader.js",
      "assets/js/gallery-data.js?v=20260501c",
      "assets/js/events-page.js"
    ],
    "gallery.html": [
      "assets/js/events-config.js?v=20260323c",
      "assets/js/event-page-paths.js",
      "assets/js/gallery-data.js?v=20260501c",
      "assets/js/gallery-page.js?v=20260501f"
    ],
    "calendar.html": [
      "assets/js/events-config.js?v=20260323c",
      "assets/js/event-page-paths.js",
      "assets/js/gallery-data.js?v=20260501c",
      "assets/js/calendar-page.js?v=20260501f"
    ],
    "donate.html": [],
    "industry-internship.html": [],
    "chair-professorship.html": [],
    "vijnana-harate.html": [
      "assets/js/program-data.js",
      "assets/js/program-page.js"
    ],
    "vijnana-aranya.html": [
      "assets/js/program-data.js",
      "assets/js/program-page.js"
    ],
    "vijnana-yuvati.html": [
      "assets/js/program-data.js",
      "assets/js/program-page.js"
    ],
    "vijnana-nataka.html": [
      "assets/js/program-data.js",
      "assets/js/program-page.js"
    ],
    "ganitha-mela.html": [
      "assets/js/program-data.js",
      "assets/js/program-page.js"
    ]
  };

  var ROUTE_INITS = {
    "index.html": "initIndexPage",
    "events.html": "initEventsPage",
    "gallery.html": "initGalleryPage",
    "calendar.html": "initCalendarPage",
    "donate.html": null,
    "industry-internship.html": null,
    "chair-professorship.html": null,
    "vijnana-harate.html": "initProgramPage",
    "vijnana-aranya.html": "initProgramPage",
    "vijnana-yuvati.html": "initProgramPage",
    "vijnana-nataka.html": "initProgramPage",
    "ganitha-mela.html": "initProgramPage"
  };

  function routeKeyFromUrl(url) {
    var pathname = new URL(url, window.location.href).pathname;
    var clean = pathname.split("/").pop() || "index.html";
    return clean === "" ? "index.html" : clean;
  }

  function isSupportedRoute(url) {
    return Object.prototype.hasOwnProperty.call(ROUTE_SCRIPTS, routeKeyFromUrl(url));
  }

  function shouldBypassClientRouting(routeKey) {
    return routeKey === "gallery.html" || routeKey === "calendar.html";
  }

  function syncHead(doc) {
    document.title = doc.title || document.title;

    syncDescription(doc);
    syncHeadAssets(doc, "style");
    syncHeadAssets(doc, 'link[rel="stylesheet"]');
    syncHeadAssets(doc, 'link[rel="icon"]');
  }

  function syncDescription(doc) {
    var next = doc.querySelector('meta[name="description"]');
    var current = document.querySelector('meta[name="description"]');
    if (!next) {
      if (current) current.remove();
      return;
    }

    if (!current) {
      current = document.createElement("meta");
      current.setAttribute("name", "description");
      document.head.appendChild(current);
    }
    current.setAttribute("content", next.getAttribute("content") || "");
  }

  function syncHeadAssets(doc, selector) {
    var existing = document.head.querySelectorAll("[data-router-managed='" + selector + "']");
    existing.forEach(function (node) {
      node.remove();
    });

    var nodes = doc.head.querySelectorAll(selector);
    nodes.forEach(function (node) {
      if (selector === 'link[rel="stylesheet"]' && /shared-ribbon\.css(?:\?|$)/.test(node.getAttribute("href") || "")) {
        return;
      }
      var clone = node.cloneNode(true);
      clone.setAttribute("data-router-managed", selector);
      document.head.appendChild(clone);
    });
  }

  function syncBodyAttributes(doc) {
    Array.prototype.slice.call(document.body.attributes).forEach(function (attr) {
      document.body.removeAttribute(attr.name);
    });
    Array.prototype.slice.call(doc.body.attributes).forEach(function (attr) {
      document.body.setAttribute(attr.name, attr.value);
    });
  }

  function replacePageContent(doc) {
    var nextMain = doc.getElementById("main");
    var currentMain = document.getElementById("main");
    if (!nextMain || !currentMain) throw new Error("Missing main content");
    currentMain.replaceWith(nextMain.cloneNode(true));

    var nextFooter = doc.querySelector(".wrap > footer");
    var currentFooter = document.querySelector(".wrap > footer");
    if (nextFooter && currentFooter) {
      currentFooter.replaceWith(nextFooter.cloneNode(true));
      return;
    }

    var nextFooterRoot = doc.getElementById("site-footer-root");
    var currentFooterRoot = document.getElementById("site-footer-root");
    if (nextFooterRoot && currentFooterRoot) {
      currentFooterRoot.replaceWith(nextFooterRoot.cloneNode(true));
    }
  }

  function loadScriptsForRoute(routeKey) {
    var list = ROUTE_SCRIPTS[routeKey] || [];
    var loaded = {};
    return list.reduce(function (chain, src) {
      return chain.then(function () {
        return ensureScript(src).then(function (wasLoadedNow) {
          loaded[src] = wasLoadedNow;
        });
      });
    }, Promise.resolve()).then(function () {
      return loaded;
    });
  }

  function ensureScript(src) {
    var absolute = new URL(src, window.location.href).href;
    var existing = Array.prototype.find.call(document.scripts, function (script) {
      return script.src === absolute;
    });
    if (existing) return Promise.resolve(false);

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = function () {
        resolve(true);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function runRouteInit(routeKey, loadedScripts) {
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

    var runtime = window.TACT_PAGE_RUNTIME || {};
    if (typeof runtime.teardownIndexPage === "function" && routeKey !== "index.html") {
      runtime.teardownIndexPage();
    }
    if (typeof runtime.teardownHomeEventsBoard === "function" && routeKey !== "index.html") {
      runtime.teardownHomeEventsBoard();
    }

    var chain = Promise.resolve();

    if (
      routeKey === "index.html" &&
      !loadedScripts["assets/js/home-events-board.js"] &&
      typeof runtime.initHomeEventsBoard === "function"
    ) {
      chain = chain.then(function () {
        return runtime.initHomeEventsBoard();
      });
    }

    var initName = ROUTE_INITS[routeKey];
    return chain.then(function () {
      if (
        initName &&
        shouldRunInit(routeKey, loadedScripts) &&
        typeof runtime[initName] === "function"
      ) {
        return runtime[initName]();
      }
    }).then(function () {
      var year = document.getElementById("year");
      if (year) year.textContent = String(new Date().getFullYear());
    });
  }

  function scrollAfterNavigation(url) {
    var targetUrl = new URL(url, window.location.href);
    if (targetUrl.hash) {
      var target = document.getElementById(targetUrl.hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }

  function navigate(url, options) {
    var settings = options || {};
    if (!isSupportedRoute(url)) {
      window.location.href = url;
      return Promise.resolve();
    }

    return fetch(url, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("Navigation failed");
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        syncHead(doc);
        syncBodyAttributes(doc);
        replacePageContent(doc);
        var routeKey = routeKeyFromUrl(url);
        return loadScriptsForRoute(routeKey).then(function (loadedScripts) {
          if (settings.historyMode === "push") {
            history.pushState({ url: url }, "", url);
          } else if (settings.historyMode === "replace") {
            history.replaceState({ url: url }, "", url);
          }
          return runRouteInit(routeKey, loadedScripts).then(function () {
            scrollAfterNavigation(url);
          });
        });
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  function handleLinkClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    var href = link.getAttribute("href");
    if (!href || href.indexOf("#") === 0 || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;

    var url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    var routeKey = routeKeyFromUrl(url.href);
    if (shouldBypassClientRouting(routeKey)) return;
    if (!isSupportedRoute(url.href)) return;

    event.preventDefault();
    navigate(url.href, { historyMode: "push" });
  }

  function handlePopState() {
    navigate(window.location.href, { historyMode: "replace" });
  }

  function initRouter() {
    if (!window.fetch || !window.DOMParser || !window.history || !window.history.pushState) return;
    if (document.documentElement.dataset.routerInit === "true") return;
    document.documentElement.dataset.routerInit = "true";

    markCurrentHeadAssets("style");
    markCurrentHeadAssets('link[rel="stylesheet"]');
    markCurrentHeadAssets('link[rel="icon"]');

    history.replaceState({ url: window.location.href }, "", window.location.href);
    document.addEventListener("click", handleLinkClick);
    window.addEventListener("popstate", handlePopState);
  }

  function shouldRunInit(routeKey, loadedScripts) {
    if (routeKey === "index.html") {
      return !loadedScripts["assets/js/index-page.js"];
    }
    if (routeKey === "events.html") {
      return !loadedScripts["assets/js/events-page.js"];
    }
    if (routeKey === "gallery.html") {
      return !loadedScripts["assets/js/gallery-page.js?v=20260501f"];
    }
    if (routeKey === "calendar.html") {
      return !loadedScripts["assets/js/calendar-page.js?v=20260501f"];
    }
    if (routeKey === "vijnana-harate.html" ||
        routeKey === "vijnana-aranya.html" ||
        routeKey === "vijnana-yuvati.html" ||
        routeKey === "vijnana-nataka.html" ||
        routeKey === "ganitha-mela.html") {
      return !loadedScripts["assets/js/program-page.js"];
    }
    return true;
  }

  function markCurrentHeadAssets(selector) {
    var nodes = document.head.querySelectorAll(selector);
    nodes.forEach(function (node) {
      if (selector === 'link[rel="stylesheet"]' && /shared-ribbon\.css(?:\?|$)/.test(node.getAttribute("href") || "")) {
        return;
      }
      node.setAttribute("data-router-managed", selector);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRouter, { once: true });
  } else {
    initRouter();
  }
})();
