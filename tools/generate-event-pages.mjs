import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve("/home/tact/tact");
const eventsRoot = path.join(repoRoot, "content", "events");
const pagesRoot = path.join(repoRoot, "events");

function shellFor(slug) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1240">
  <title>Event - The Academy Trust (tAcT)</title>
  <meta name="description" content="Event details from The Academy Trust (tAcT).">
  <link rel="stylesheet" href="../shared-ribbon.css">
  <link rel="stylesheet" href="../assets/css/public-site.css">
  <link rel="stylesheet" href="../assets/css/gallery.css">
  <link rel="stylesheet" href="../assets/css/event-detail.css">
</head>
<body data-page="event-detail" data-site-root="../" data-event-slug="${slug}">
  <div class="wrap">
    <div id="site-header-root"></div>
    <main id="main">
      <section class="surface"><p class="event-detail-empty">Loading event details…</p></section>
    </main>
    <div id="site-footer-root"></div>
  </div>

  <div id="gallery-modal" class="gallery-modal" hidden>
    <div class="gallery-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-modal-title">
      <button id="gallery-modal-close" class="gallery-modal-close" type="button" aria-label="Close gallery modal" data-modal-dismiss>&times;</button>
      <div class="gallery-modal-media">
        <img id="gallery-modal-image" src="" alt="">
      </div>
      <div class="gallery-modal-copy">
        <h2 id="gallery-modal-title"></h2>
        <div class="gallery-modal-meta">
          <span id="gallery-modal-date"></span>
          <span id="gallery-modal-location"></span>
        </div>
        <p id="gallery-modal-description"></p>
      </div>
    </div>
  </div>

  <script src="../assets/js/site-chrome.js"></script>
  <script src="../content/events/events-feed.js"></script>
  <script src="../assets/js/gallery-data.js"></script>
  <script src="../assets/js/event-detail-page.js"></script>
</body>
</html>
`;
}

async function main() {
  const entries = await fs.readdir(eventsRoot, { withFileTypes: true });
  await fs.mkdir(pagesRoot, { recursive: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const eventJsonPath = path.join(eventsRoot, entry.name, "event.json");
    try {
      const raw = await fs.readFile(eventJsonPath, "utf8");
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
      const slug = String(parsed.slug || entry.name).trim();
      if (!slug) continue;
      await fs.writeFile(path.join(pagesRoot, `${slug}.html`), shellFor(slug), "utf8");
    } catch {
      // Skip folders without valid event metadata.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
