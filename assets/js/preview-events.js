/* ══════════════════════════════════════════════════════════════
   PREVIEW EVENTS, for boss review/demo only
   TO DELETE: remove this file + its <script> tag from every page
   ══════════════════════════════════════════════════════════════ */
(function () {
  var preview = [
    {
      slug: "2026-vijnana-harate-bengaluru-preview",
      title: "Vijnana Harate, Bengaluru School Session",
      date: "2026-06-10",
      time: "10:00 AM – 1:00 PM",
      location: "Bengaluru, Karnataka",
      status: "scheduled",
      poster: "content/events/2026-vijnana-harate-bengaluru-preview/poster.svg",
      pageUrl: "events/10-06-2026-vijnana-harate-bengaluru-preview.html",
      teaser: "Scientists meet school students for informal conversations about research, careers, and everyday science.",
      homepageMatter: "An upcoming Vijnana Harate session bringing scientists and school students together for relaxed conversations about science, research, and everyday curiosity."
    },
    {
      slug: "2026-vijnana-aranya-hassan-preview",
      title: "Vijnana Aranya, Rural Outreach Visit",
      date: "2026-07-05",
      time: "9:30 AM – 3:00 PM",
      location: "Hassan District, Karnataka",
      status: "scheduled",
      poster: "content/events/2026-vijnana-aranya-hassan-preview/poster.svg",
      pageUrl: "events/05-07-2026-vijnana-aranya-hassan-preview.html",
      teaser: "Outreach visit to a rural government school connecting students with scientists for hands-on demonstrations and science Q&A.",
      homepageMatter: "Scientists visit a rural government school in Hassan District with hands-on demonstrations, open Q&A on science and nature, and conversations about research careers."
    },
    {
      slug: "2026-ganitha-mela-mysuru-preview",
      title: "Ganitha Mela, Mysuru",
      date: "2026-08-20",
      time: "10:30 AM – 4:00 PM",
      location: "Mysuru, Karnataka",
      status: "scheduled",
      poster: "content/events/2026-ganitha-mela-mysuru-preview/poster.svg",
      pageUrl: "events/20-08-2026-ganitha-mela-mysuru-preview.html",
      teaser: "A full-day mathematics festival with hands-on activities, puzzles, and maths games making abstract concepts tangible and joyful.",
      homepageMatter: "A full-day Ganitha Mela in Mysuru with hands-on mathematics activities, puzzles, and games for school students, making abstract ideas tangible and connected to everyday life."
    }
  ];

  var existing = Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED : [];
  var existingSlugs = {};
  existing.forEach(function (e) { if (e.slug) existingSlugs[e.slug] = true; });
  var toAdd = preview.filter(function (e) { return !existingSlugs[e.slug]; });
  window.TACT_EVENT_FEED = toAdd.concat(existing);
})();
