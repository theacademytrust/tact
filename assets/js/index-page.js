(function () {
  var state = {
    observer: null,
    slideshowTimer: null,
    heroReady: false
  };

  function initIndexPage() {
    if (window.TACT_CHROME) {
      if (typeof window.TACT_CHROME.ensureHeader === "function") {
        window.TACT_CHROME.ensureHeader();
      } else {
        window.TACT_CHROME.renderHeader();
      }
      window.TACT_CHROME.initDropdowns();
    }

    teardownIndexPage();

    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var sections = document.querySelectorAll(".fade-section");
    if (!prefersReduced && "IntersectionObserver" in window) {
      state.observer = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              obs.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.01,
          rootMargin: "0px 0px 160px 0px"
        }
      );

      sections.forEach(function (section) {
        state.observer.observe(section);
      });
    } else {
      sections.forEach(function (section) {
        section.classList.add("in-view");
      });
    }

    var supportsSmooth = "scrollBehavior" in document.documentElement.style;
    if (!prefersReduced && supportsSmooth) {
      var links = document.querySelectorAll('a[href^="#"]');
      links.forEach(function (link) {
        if (link.dataset.indexSmoothBound === "true") return;
        link.dataset.indexSmoothBound = "true";
        link.addEventListener("click", function (event) {
          var href = link.getAttribute("href");
          if (!href || href === "#") return;
          var target = document.querySelector(href);
          if (!target) return;
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          try {
            history.pushState(null, "", href);
          } catch (_error) {
            // Ignore URL update failures.
          }
        });
      });
    }

    var infoCardToggles = document.querySelectorAll(".info-card-toggle[data-info-card-target]");
    infoCardToggles.forEach(function (toggle) {
      var targetId = toggle.getAttribute("data-info-card-target");
      var body = document.getElementById(targetId);
      if (!body) return;

      var card = toggle.closest(".info-card");
      if (!card) return;

      body.style.maxHeight = "0px";

      function openCard() {
        card.classList.add("info-card--open");
        toggle.setAttribute("aria-expanded", "true");
        body.style.maxHeight = body.scrollHeight + "px";
      }

      function closeCard() {
        card.classList.remove("info-card--open");
        toggle.setAttribute("aria-expanded", "false");
        body.style.maxHeight = "0px";
      }

      if (toggle.dataset.indexCardBound === "true") return;
      toggle.dataset.indexCardBound = "true";
      toggle.addEventListener("click", function () {
        if (card.classList.contains("info-card--open")) {
          closeCard();
          return;
        }
        openCard();
      });
    });

    var slideshowSlides = document.querySelectorAll(".slideshow-slide");
    if (!slideshowSlides.length) return;

    primeHeroMedia(slideshowSlides);

    var currentSlide = 0;
    function showSlide(index) {
      slideshowSlides.forEach(function (slide, slideIndex) {
        slide.classList.toggle("active", slideIndex === index);
      });
    }

    function nextSlide() {
      currentSlide = (currentSlide + 1) % slideshowSlides.length;
      showSlide(currentSlide);
    }

    showSlide(currentSlide);
    state.slideshowTimer = window.setInterval(nextSlide, 5000);
  }

  function teardownIndexPage() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.slideshowTimer) {
      window.clearInterval(state.slideshowTimer);
      state.slideshowTimer = null;
    }
    state.heroReady = false;
    document.documentElement.classList.remove("hero-media-ready");
  }

  function primeHeroMedia(slides) {
    if (state.heroReady) return;

    var firstImage = slides[0] && slides[0].querySelector("img");
    if (!firstImage) {
      document.documentElement.classList.add("hero-media-ready");
      state.heroReady = true;
      return;
    }

    var reveal = function () {
      if (state.heroReady) return;
      state.heroReady = true;
      document.documentElement.classList.add("hero-media-ready");
    };

    if (typeof firstImage.decode === "function") {
      firstImage.decode().then(reveal).catch(reveal);
    } else if (firstImage.complete) {
      reveal();
    } else {
      firstImage.addEventListener("load", reveal, { once: true });
      firstImage.addEventListener("error", reveal, { once: true });
    }
  }

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initIndexPage = initIndexPage;
  window.TACT_PAGE_RUNTIME.teardownIndexPage = teardownIndexPage;

  if (document.getElementById("arrival-heading")) {
    initIndexPage();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("arrival-heading")) {
        initIndexPage();
      }
    }, { once: true });
  }
})();
