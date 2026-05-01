function initProgramPage() {
  if (window.TACT_CHROME) {
    if (typeof window.TACT_CHROME.ensureHeader === "function") {
      window.TACT_CHROME.ensureHeader();
    } else {
      window.TACT_CHROME.renderHeader();
    }
    window.TACT_CHROME.initDropdowns();
  }

  var body = document.body;
  var slug = body ? body.getAttribute("data-program-slug") : null;
  var data = window.TACT_PROGRAMS && slug ? window.TACT_PROGRAMS[slug] : null;

  if (!data) return;

  body.classList.add("program-page", "program-page--" + slug);
  document.title = data.title + " - The Academy Trust (tAcT)";
  setMetaDescription(data.heroText);

  var hero = document.getElementById("hero");
  hero.style.backgroundImage =
    "linear-gradient(180deg, rgba(8, 26, 20, 0.55), rgba(8, 26, 20, 0.55)), url('" + data.heroImage + "')";

  setText("program-title", data.title);
  setText("hero-text", data.heroText);
  setText("about-title", data.aboutTitle);
  setText("visit-title", data.visitTitle);
  setText("gallery-title", data.galleryTitle);
  setText("impact-text", data.impact);

  var badges = document.getElementById("badge-row");
  badges.innerHTML = "";
  data.badges.forEach(function (badge) {
    var span = document.createElement("span");
    span.className = "badge";
    span.textContent = badge;
    badges.appendChild(span);
  });
  renderHeroStats(data);

  var about = document.getElementById("about-content");
  about.innerHTML = "";
  data.about.forEach(function (line) {
    var p = document.createElement("p");
    p.textContent = line;
    about.appendChild(p);
  });
  renderProfile(data);

  var visit = document.getElementById("visit-list");
  visit.innerHTML = "";
  data.visit.forEach(function (line) {
    var li = document.createElement("li");
    if (typeof line === "string") {
      li.textContent = line;
    } else {
      var title = document.createElement("span");
      title.className = "visit-step-title";
      title.textContent = line.title || "";
      li.appendChild(title);

      var text = document.createElement("span");
      text.className = "visit-step-text";
      text.textContent = line.text || "";
      li.appendChild(text);
    }
    visit.appendChild(li);
  });
  renderMoments(data);

  var gallery = document.getElementById("gallery-grid");
  gallery.innerHTML = "";
  data.gallery.forEach(function (item) {
    if (item.type === "image") {
      var figure = document.createElement("figure");
      figure.className = "gallery-figure";

      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || data.title + " image";
      img.loading = "lazy";
      img.decoding = "async";
      figure.appendChild(img);

      if (item.caption) {
        var caption = document.createElement("figcaption");
        caption.textContent = item.caption;
        figure.appendChild(caption);
      }

      gallery.appendChild(figure);
      return;
    }

    if (item.type === "card") {
      var card = document.createElement("article");
      card.className = "surface gallery-card program-gallery-card";

      var h3 = document.createElement("h3");
      h3.textContent = item.title || "";
      card.appendChild(h3);

      var p = document.createElement("p");
      p.textContent = item.text || "";
      card.appendChild(p);

      gallery.appendChild(card);
    }
  });
  renderImpactPoints(data);

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
window.TACT_PAGE_RUNTIME.initProgramPage = initProgramPage;

if (document.getElementById("program-title")) {
  initProgramPage();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("program-title")) {
      initProgramPage();
    }
  }, { once: true });
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setMetaDescription(value) {
  var meta = document.querySelector('meta[name="description"]');
  if (meta && value) meta.setAttribute("content", value);
}

function renderHeroStats(data) {
  var heroText = document.getElementById("hero-text");
  var hero = document.getElementById("hero");
  if (!heroText || !hero) return;

  removeExisting(hero, ".program-stat-row");
  if (!Array.isArray(data.stats) || !data.stats.length) return;

  var row = document.createElement("div");
  row.className = "program-stat-row";
  data.stats.forEach(function (item) {
    var card = document.createElement("span");
    card.className = "program-stat";

    var value = document.createElement("strong");
    value.textContent = item.value || "";
    card.appendChild(value);

    var label = document.createElement("span");
    label.textContent = item.label || "";
    card.appendChild(label);

    row.appendChild(card);
  });

  heroText.insertAdjacentElement("afterend", row);
}

function renderProfile(data) {
  var about = document.getElementById("about-content");
  if (!about) return;

  removeExisting(about, ".program-profile-grid");
  if (!Array.isArray(data.profile) || !data.profile.length) return;

  var grid = document.createElement("div");
  grid.className = "program-profile-grid";
  data.profile.forEach(function (item) {
    var card = document.createElement("article");
    card.className = "program-profile-card";

    var label = document.createElement("span");
    label.textContent = item.label || "";
    card.appendChild(label);

    var value = document.createElement("p");
    value.textContent = item.value || "";
    card.appendChild(value);

    grid.appendChild(card);
  });

  about.appendChild(grid);
}

function renderMoments(data) {
  var gallerySection = document.getElementById("gallery");
  if (!gallerySection) return;

  var existing = document.getElementById("program-moments");
  if (existing) existing.remove();

  if (!Array.isArray(data.moments) || !data.moments.length) return;

  var section = document.createElement("section");
  section.id = "program-moments";
  section.className = "section surface program-moments";

  var title = document.createElement("h2");
  title.textContent = data.momentsTitle || "Documented moments";
  section.appendChild(title);

  var grid = document.createElement("div");
  grid.className = "program-moment-grid";

  data.moments.forEach(function (item) {
    var card = document.createElement(item.pageUrl ? "a" : "article");
    card.className = "program-moment-card";
    if (item.pageUrl) card.href = item.pageUrl;

    var meta = document.createElement("span");
    meta.className = "program-moment-meta";
    meta.textContent = [item.date, item.place].filter(Boolean).join(" | ");
    card.appendChild(meta);

    var heading = document.createElement("h3");
    heading.textContent = item.title || "";
    card.appendChild(heading);

    var text = document.createElement("p");
    text.textContent = item.text || "";
    card.appendChild(text);

    grid.appendChild(card);
  });

  section.appendChild(grid);
  gallerySection.parentNode.insertBefore(section, gallerySection);
}

function renderImpactPoints(data) {
  var impactText = document.getElementById("impact-text");
  if (!impactText) return;

  var section = impactText.closest(".surface");
  if (!section) return;

  removeExisting(section, ".program-impact-list");
  if (!Array.isArray(data.impactPoints) || !data.impactPoints.length) return;

  var list = document.createElement("ul");
  list.className = "program-impact-list";
  data.impactPoints.forEach(function (item) {
    var li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  impactText.insertAdjacentElement("afterend", list);
}

function removeExisting(root, selector) {
  var existing = root.querySelector(selector);
  if (existing) existing.remove();
}
