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

  document.title = data.title + " - The Academy Trust (tAcT)";

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

  var about = document.getElementById("about-content");
  about.innerHTML = "";
  data.about.forEach(function (line) {
    var p = document.createElement("p");
    p.textContent = line;
    about.appendChild(p);
  });

  var visit = document.getElementById("visit-list");
  visit.innerHTML = "";
  data.visit.forEach(function (line) {
    var li = document.createElement("li");
    li.textContent = line;
    visit.appendChild(li);
  });

  var gallery = document.getElementById("gallery-grid");
  gallery.innerHTML = "";
  data.gallery.forEach(function (item) {
    if (item.type === "image") {
      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || data.title + " image";
      img.loading = "lazy";
      gallery.appendChild(img);
      return;
    }

    if (item.type === "card") {
      var card = document.createElement("article");
      card.className = "surface gallery-card";

      var h3 = document.createElement("h3");
      h3.textContent = item.title || "";
      card.appendChild(h3);

      var p = document.createElement("p");
      p.textContent = item.text || "";
      card.appendChild(p);

      gallery.appendChild(card);
    }
  });

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
