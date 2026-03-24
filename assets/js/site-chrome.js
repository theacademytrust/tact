(function () {
  var chromeState = {
    globalDropdownBound: false,
    openItem: null
  };

  function getSiteRoot() {
    var root = document.body && document.body.dataset ? document.body.dataset.siteRoot : "";
    root = String(root || "").trim();
    return root ? root.replace(/\/?$/, "/") : "";
  }

  function toSitePath(path) {
    return getSiteRoot() + String(path || "").replace(/^\/+/, "");
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

  function renderSiteHeader() {
    var root = document.getElementById("site-header-root");
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
      '          <li class="nav-item nav-item--has-menu">',
      '            <button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false">Outreach Programs</button>',
      '            <ul class="nav-menu" role="menu">',
      '              <li><a href="' + toSitePath("vijnana-harate.html") + '" role="menuitem">Vijnana Harate</a></li>',
      '              <li><a href="' + toSitePath("vijnana-aranya.html") + '" role="menuitem">Vijnana Aranya</a></li>',
      '              <li><a href="' + toSitePath("vijnana-yuvati.html") + '" role="menuitem">Vijnana Yuvati</a></li>',
      '              <li><a href="' + toSitePath("vijnana-nataka.html") + '" role="menuitem">Vijnana Nataka</a></li>',
      '              <li><a href="' + toSitePath("ganitha-mela.html") + '" role="menuitem">Ganitha Mela</a></li>',
      "            </ul>",
      "          </li>",
      '          <li class="nav-item nav-item--has-menu">',
      '            <button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false">Other Initiatives</button>',
      '            <ul class="nav-menu" role="menu">',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Industry Internship</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Chair Professorship</a></li>',
      "            </ul>",
      "          </li>",
      '          <li class="nav-item nav-item--has-menu">',
      '            <button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false">Events & Media</button>',
      '            <ul class="nav-menu" role="menu">',
      '              <li><a href="' + toSitePath("events.html#upcoming") + '" role="menuitem">Upcoming Events</a></li>',
      '              <li><a href="' + toSitePath("events.html#past") + '" role="menuitem">Past Events</a></li>',
      '              <li><a href="' + toSitePath("gallery.html") + '" role="menuitem">Gallery</a></li>',
      '              <li><a href="' + toSitePath("calendar.html") + '" role="menuitem">Calendar</a></li>',
      "            </ul>",
      "          </li>",
      '          <li class="nav-item nav-item--has-menu">',
      '            <button class="nav-trigger" type="button" aria-haspopup="true" aria-expanded="false">Governance</button>',
      '            <ul class="nav-menu" role="menu">',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Founding Trustees</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Current Trustees</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Outreach Committee</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Annual Reports</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Statutory Documents</a></li>',
      '              <li><a href="' + toSitePath("wait.html") + '" role="menuitem">Office & Contact</a></li>',
      "            </ul>",
      "          </li>",
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
    var root = document.getElementById("site-header-root");
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

    var navItems = document.querySelectorAll(".nav-item--has-menu");

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
