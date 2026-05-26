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
        ["Industry Internship", "industry-internship.html"],
        ["Chair Professorship", "chair-professorship.html"]
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
        ["Trust Documents", "trust-documents.html"],
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
    if (!root) {
      root = document.createElement("div");
      root.id = "site-header-root";
    }
    if (!document.body) return root;

    // The HTML files hardcode #site-header-root INSIDE .wrap.
    // We must move it to be a direct body child BEFORE .wrap so that the
    // transform: scale() we apply to .wrap does not create a new containing
    // block for the position:fixed header (which would break its fixed behaviour).
    var wrap = document.querySelector("body > .wrap");
    if (wrap) {
      // insertBefore is safe even when root is already the node just before wrap.
      document.body.insertBefore(root, wrap);
    } else if (root.parentNode !== document.body) {
      document.body.insertBefore(root, document.body.firstChild);
    }
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

    // When the viewport is narrow, --vp-scale is set and the header is visually
    // smaller than its offsetHeight.  Compute the actual visible height so the
    // spacer reserves exactly the right amount of room above .wrap content.
    var scale = parseFloat(
      document.documentElement.style.getPropertyValue("--vp-scale") || "1"
    ) || 1;
    var totalOffset = Math.ceil(header.offsetHeight * scale + 12);
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

    var navCols = NAV_GROUPS.map(function (group) {
      var id = "sfv2-" + group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      var links = group.links.map(function (link) {
        return "<li><a href=\"" + toSitePath(link[1]) + "\">" + link[0] + "</a></li>";
      }).join("");
      return (
        "<div class=\"sfv2-col\">" +
          "<h2 id=\"" + id + "\">" + group.label + "</h2>" +
          "<ul aria-labelledby=\"" + id + "\">" + links + "</ul>" +
        "</div>"
      );
    }).join("");

    root.innerHTML = [
      "<footer class=\"site-footer-v2\" aria-label=\"Site footer\" role=\"contentinfo\">",
      "  <div class=\"sfv2-grid\">",
      "    <div class=\"sfv2-brand\">",
      "      <a href=\"" + toSitePath("index.html") + "\" class=\"sfv2-brand-link\" aria-label=\"Go to homepage\">",
      "        <img src=\"" + toSitePath("assets/images/tact-logo.jpg") + "\" alt=\"tAcT logo\" class=\"sfv2-brand-logo\" loading=\"lazy\" decoding=\"async\">",
      "        <span class=\"sfv2-brand-name\">The Academy Trust</span>",
      "      </a>",
      "      <p class=\"sfv2-tagline\">Science outreach and public programmes. Founded by the Indian Academy of Sciences in 2014.</p>",
      "      <a href=\"" + toSitePath("donate.html") + "\" class=\"sfv2-donate-btn\">Support tAcT</a>",
      "    </div>",
      navCols,
      "  </div>",
      "  <div class=\"sfv2-bottom\">",
      "    <span>&copy; 2026 The Academy Trust (tAcT). Science outreach and public programmes.</span>",
      "    <div class=\"sfv2-bottom-links\">",
      "      <a href=\"" + toSitePath("trust-documents.html") + "\">Trust Documents</a>",
      "      <a href=\"" + toSitePath("annual-reports.html") + "\">Annual Reports</a>",
      "      <a href=\"" + toSitePath("office-contacts.html") + "\">Contact</a>",
      "    </div>",
      "  </div>",
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

  // ── Viewport scaling: shrink the 1240px desktop layout to fit narrow windows ──
  //
  // Approach:
  //   • transform: scale(x) + transform-origin: top left on .wrap
  //       → content always grows from the left edge; no centering artifact
  //       → .wrap's fixed 1200px layout shrinks to fit the viewport
  //   • #site-header-root is kept BEFORE .wrap (ensureHeaderRoot does this).
  //       → the position:fixed header has no transformed ancestor, so it
  //         remains fixed to the viewport, not to .wrap.
  //   • --vp-scale CSS variable lets the header scale itself independently
  //       via  transform: translateX(-50%) scale(var(--vp-scale, 1))  in CSS.
  //   • Negative marginBottom on .wrap compensates for the layout height that
  //       transform: scale() does NOT reduce (transform doesn't affect layout).
  //   • window.load call recalculates after images / dynamic content have settled.
  //
  // Mobile browsers handle their own scaling via the viewport meta tag
  //   <meta name="viewport" content="width=1240">
  // and see window.innerWidth = 1240, so scale = 1 and no JS scaling is applied.
  var DESIGN_WIDTH = 1240;

  function applyViewportScale() {
    var vw = window.innerWidth;
    var scale = vw < DESIGN_WIDTH ? vw / DESIGN_WIDTH : 1;

    // Clear any leftover zoom from the previous approach
    document.body.style.zoom = "";

    var wrap = document.querySelector(".wrap");
    if (wrap) {
      if (scale < 1) {
        wrap.style.transformOrigin = "top left";
        wrap.style.transform      = "scale(" + scale + ")";
        // offsetHeight is always pre-transform (transform never affects layout),
        // so this correctly measures the full natural height of .wrap.
        wrap.style.marginBottom   = "-" + Math.round(wrap.offsetHeight * (1 - scale)) + "px";
        document.documentElement.style.overflowX = "hidden";
      } else {
        wrap.style.transformOrigin = "";
        wrap.style.transform       = "";
        wrap.style.marginBottom    = "";
        document.documentElement.style.overflowX = "";
      }
    }

    // Publish scale for the CSS rule on .site-header
    if (scale < 1) {
      document.documentElement.style.setProperty("--vp-scale", String(scale));
    } else {
      document.documentElement.style.removeProperty("--vp-scale");
    }

    syncHeaderOffset();
  }

  window.TACT_CHROME = {
    ensureHeader: ensureHeader,
    ensureFooter: ensureFooter,
    ensureStylesheet: ensureRibbonStylesheet,
    renderHeader: renderSiteHeader,
    renderFooter: renderSiteFooter,
    initDropdowns: initDropdowns,
    syncHeaderOffset: syncHeaderOffset,
    applyViewportScale: applyViewportScale
  };

  window.addEventListener("resize", applyViewportScale);
  window.addEventListener("resize", syncHeaderOffset);
  // Re-run after images and late-loading content have settled so that
  // .wrap's offsetHeight (used for marginBottom) is the final value.
  window.addEventListener("load", applyViewportScale);

  function bootChrome() {
    ensureHeader();
    initDropdowns();
    applyViewportScale();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootChrome, { once: true });
  } else {
    bootChrome();
  }
})();
