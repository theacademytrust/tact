(function () {
  var activeScript = document.currentScript;
  var NAV_GROUPS = [
    {
      label: "Outreach Programs",
      links: [
        ["Vijnana Harate", "vijnana-harate.html"],
        ["Vijnana Aranya", "vijnana-aranya.html"],
        ["Vijnana Yuvati", "vijnana-yuvati.html"],
        ["Vijnana Nataka", "vijnana-nataka.html"],
        ["Ganitha Mela", "ganitha-mela.html"]
      ]
    },
    {
      label: "Other Initiatives",
      links: [
        ["Industry Internship", "wait.html"],
        ["Chair Professorship", "wait.html"]
      ]
    },
    {
      label: "Events & Media",
      links: [
        ["Upcoming Events", "events.html#upcoming"],
        ["Past Events", "events.html#past"],
        ["Gallery", "gallery.html"],
        ["Calendar", "calendar.html"]
      ]
    },
    {
      label: "Governance",
      links: [
        ["Founding Trustees", "founding-trustees.html"],
        ["Current Trustees", "current-trustees.html"],
        ["Outreach Committee", "outreach-committee.html"],
        ["Annual Reports", "annual-reports.html"],
        ["State Documents", "state-documents.html"],
        ["Office & Contacts", "office-contacts.html"]
      ]
    }
  ];

  var chromeState = {
    globalDropdownBound: false,
    openItem: null
  };

  function getScriptRoot() {
    var src = activeScript && activeScript.getAttribute ? activeScript.getAttribute("src") : "";
    var marker = "assets/js/site-chrome.js";
    var markerIndex = String(src || "").indexOf(marker);
    if (markerIndex === -1) return "";
    return src.slice(0, markerIndex);
  }

  function getSiteRoot() {
    var root = document.body && document.body.dataset ? document.body.dataset.siteRoot : "";
    root = String(root || "").trim();
    if (!root) root = getScriptRoot();
    return root ? root.replace(/\/?$/, "/") : "";
  }

  function toSitePath(path) {
    return getSiteRoot() + String(path || "").replace(/^\/+/, "");
  }

  function ensureRibbonStylesheet() {
    if (!document.head) return;
    var existing = document.head.querySelector('link[href*="shared-ribbon.css"]');
    if (existing) return;

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = toSitePath("shared-ribbon.css");
    link.setAttribute("data-site-chrome-style", "true");
    document.head.appendChild(link);
  }

  function ensureHeaderRoot() {
    var root = document.getElementById("site-header-root");
    if (root) return root;
    if (!document.body) return null;

    root = document.createElement("div");
    root.id = "site-header-root";

    var shell = document.querySelector(".wrap") || document.body;
    var main = shell.querySelector("#main") || shell.querySelector("main");
    shell.insertBefore(root, main || shell.firstChild);
    return root;
  }

  function syncHeaderOffset() {
    var root = document.getElementById("site-header-root");
    if (!root) return;

    var header = root.querySelector(".site-header");
    if (!header) {
      root.style.removeProperty("min-height");
      document.documentElement.style.removeProperty("--site-header-offset");
      return;
    }

    var totalOffset = Math.ceil(header.offsetHeight + 12);
    root.style.minHeight = totalOffset + "px";
    document.documentElement.style.setProperty("--site-header-offset", totalOffset + "px");
  }

  function renderNavGroup(group) {
    var items = group.links.map(function (link) {
      return '              <li><a href="' + toSitePath(link[1]) + '" role="menuitem">' + link[0] + "</a></li>";
    }).join("");

    return [
      '          <li class="nav-item nav-item--has-menu">',
      '            <button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false">' + group.label + "</button>",
      '            <ul class="nav-menu" role="menu">',
      items,
      "            </ul>",
      "          </li>"
    ].join("");
  }

  function renderSiteHeader() {
    ensureRibbonStylesheet();
    var root = ensureHeaderRoot();
    if (!root) return;

    root.innerHTML = [
      '<header class="site-header">',
      '  <div class="site-header-inner">',
      '    <div class="site-header-left">',
      '      <a href="' + toSitePath("index.html") + '" class="brand-link">',
      '        <img src="' + toSitePath("assets/images/tact-logo.jpg") + '" alt="tAcT logo" class="site-logo" loading="lazy" decoding="async">',
      '        <div class="site-brand-text">',
      '          <span class="site-brand-title">The Academy Trust</span>',
      '          <span class="site-brand-subtitle">Science outreach</span>',
      "        </div>",
      "      </a>",
      "    </div>",
      '    <div class="site-header-center">',
      '      <nav class="site-nav" aria-label="Primary navigation">',
      '        <ul class="nav-list">',
      NAV_GROUPS.map(renderNavGroup).join(""),
      "        </ul>",
      "      </nav>",
      "    </div>",
      '    <div class="site-header-right">',
      '      <a href="' + toSitePath("donate.html") + '" class="nav-link nav-link--primary"><span>Donate</span></a>',
      "    </div>",
      "  </div>",
      "</header>"
    ].join("");
    delete root.dataset.dropdownInit;
    syncHeaderOffset();
  }

  function renderSiteFooter() {
    var root = document.getElementById("site-footer-root");
    if (!root) return;

    root.innerHTML = [
      '<footer class="site-footer" aria-label="Site footer">',
      "  <p>&copy; 2026 Academic Trust Science Outreach</p>",
      "</footer>"
    ].join("");
  }

  function ensureHeader() {
    ensureRibbonStylesheet();
    var root = ensureHeaderRoot();
    if (root && !root.querySelector(".site-header")) {
      renderSiteHeader();
    }
    ensureFooter();
  }

  function ensureFooter() {
    var root = document.getElementById("site-footer-root");
    if (!root) return;
    if (root.querySelector(".site-footer")) return;
    renderSiteFooter();
  }

  function initDropdowns() {
    var root = document.getElementById("site-header-root");
    if (!root || root.dataset.dropdownInit === "true") return;
    root.dataset.dropdownInit = "true";

    var navItems = root.querySelectorAll(".nav-item--has-menu");

    function closeMenu(item) {
      if (!item) return;
      item.classList.remove("nav-item--open");
      var trigger = item.querySelector('.nav-trigger[aria-haspopup="true"]');
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (chromeState.openItem === item) chromeState.openItem = null;
    }

    navItems.forEach(function (item) {
      var trigger = item.querySelector('.nav-trigger[aria-haspopup="true"]');
      var menu = item.querySelector(".nav-menu");
      if (!trigger || !menu) return;

      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var isOpen = item.classList.contains("nav-item--open");
        if (isOpen) {
          closeMenu(item);
          return;
        }
        if (chromeState.openItem && chromeState.openItem !== item) closeMenu(chromeState.openItem);
        item.classList.add("nav-item--open");
        trigger.setAttribute("aria-expanded", "true");
        chromeState.openItem = item;
      });

      menu.addEventListener("click", function (event) {
        var link = event.target.closest("a[href]");
        if (!link) return;
        closeMenu(item);
      });
    });

    if (!chromeState.globalDropdownBound) {
      chromeState.globalDropdownBound = true;

      document.addEventListener("click", function (event) {
        if (chromeState.openItem && !chromeState.openItem.contains(event.target)) {
          closeMenu(chromeState.openItem);
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && chromeState.openItem) {
          closeMenu(chromeState.openItem);
        }
      });
    }
  }

  window.TACT_CHROME = {
    ensureHeader: ensureHeader,
    ensureFooter: ensureFooter,
    ensureStylesheet: ensureRibbonStylesheet,
    renderHeader: renderSiteHeader,
    renderFooter: renderSiteFooter,
    initDropdowns: initDropdowns,
    syncHeaderOffset: syncHeaderOffset
  };

  window.addEventListener("resize", syncHeaderOffset);

  function bootChrome() {
    ensureHeader();
    initDropdowns();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootChrome, { once: true });
  } else {
    bootChrome();
  }
})();
