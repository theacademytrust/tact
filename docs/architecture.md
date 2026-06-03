# Architecture

## Overview

TACT is a **static site with a serverless content management layer**. There is no traditional web server, no database, and no build step required to deploy. The repository itself is the database — all content lives as files committed to `main`, and GitHub Pages serves them directly.

```
Browser  ──►  GitHub Pages (static files)
                  │
                  └── content/events/events-feed.js  (event data)
                  └── data/gallery.json              (gallery data)

Admin    ──►  admin.html  ──►  Google Apps Script
                                    │
                                    └── GitHub API  ──►  repo files
                                                            │
                                                            └── GitHub Actions ──► GitHub Pages
```

---

## Frontend Layer

### No Framework Policy

Zero external JavaScript or CSS frameworks are used. No jQuery, React, Vue, Tailwind, or Bootstrap. Every interactive feature is written in vanilla DOM APIs. This is intentional — it eliminates dependency management, reduces attack surface, and keeps pages fast.

### HTML Page Shell Pattern

Every public page follows the same shell:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1240">
  <script>
    /* Inline: scale page down on narrow viewports using CSS zoom */
  </script>
  <link rel="stylesheet" href="shared-ribbon.css">
  <link rel="stylesheet" href="assets/css/public-site.css">
  <link rel="stylesheet" href="assets/css/<page>.css">
</head>
<body>
  <div class="wrap">
    <div id="site-header-root"></div>   <!-- filled by site-chrome.js -->
    <main id="main">
      <!-- Static structural markup or empty container -->
    </main>
    <div id="site-footer-root"></div>   <!-- filled by site-chrome.js -->
  </div>
  <script src="assets/js/site-chrome.js?v=..."></script>
  <script src="assets/js/page-router.js?v=..."></script>
</body>
</html>
```

The header and footer are not in the HTML — they are injected by `site-chrome.js` at load time into `#site-header-root` and `#site-footer-root`.

### Client-Side Routing (`page-router.js`)

`page-router.js` intercepts same-origin link clicks and dynamically loads the correct page-initializer script without a full page reload. Each route maps to a JS bundle and an `init()` function:

```
/events.html      →  assets/js/events-page.js       →  initEventsPage()
/gallery.html     →  assets/js/gallery-page.js      →  initGalleryPage()
/calendar.html    →  (no router — always reloads)
events/*.html     →  assets/js/event-detail-page.js →  initEventDetailPage()
```

`gallery.html` and `calendar.html` bypass the router and always do a full page load because their data is large and they benefit from fresh network fetches.

### Page-Specific Initializers

Each page has one JS file that is loaded only when that route is active:

| File | Responsibility |
|---|---|
| `index-page.js` | Hero slideshow, homepage event board |
| `events-page.js` | Upcoming/past event card grid |
| `gallery-page.js` | Photo grid, infinite scroll, full-size modal |
| `calendar-page.js` | Month grid, date cells with image previews, dual-level modal |
| `event-detail-page.js` | Two-column event detail: poster + metadata + gallery |
| `program-page.js` | Program-filtered gallery (harate/aranya/yuvati/nataka/mela) |
| `home-events-board.js` | Homepage slider with rotating images |

### Data Layer

Two global data sources are loaded on demand:

1. **`content/events/events-feed.js`** — assigns `window.TACT_EVENT_FEED`, an array of all ~130 event objects. Loaded by `events-feed-loader.js`.
2. **`data/gallery.json`** — flat array of gallery entries, each with an `images[]` array. Loaded by `gallery-data.js` which caches the result and deduplicates in-flight fetches.

---

## CSS Architecture

### Design Tokens (`assets/css/public-site.css`)

All colors, spacing, and typography are defined as CSS custom properties on `:root`:

```css
--green:   #0a7a3a
--gold:    #b8860b
--muted:   #4a5568
--surface: #ffffff
--radius:  8px
```

### Layout (`shared-ribbon.css`)

The navigation dock and footer are entirely defined in `shared-ribbon.css` (655 lines). Key features:
- Fixed position dock with `backdrop-filter: blur()`
- Dropdown menus via CSS Grid (not JS-powered)
- 5-column footer grid
- Gold glint hover animation on nav items

### Viewport Scaling

All pages use `<meta name="viewport" content="width=1240">` plus an inline script that sets `document.documentElement.style.zoom` to scale the 1240px-wide layout down on narrow viewports. This is a deliberate desktop-first design decision — there are no mobile breakpoints.

---

## Backend Layer

### Google Apps Script (`backend/google-apps-script/Code.gs`)

The only server-side component. It runs as a deployed web app at a fixed Google Apps Script URL, configured in `assets/js/events-config.js`:

```js
adminEndpoint: "https://script.google.com/macros/s/<ID>/exec"
```

It communicates over POST with a JSON body. All actions are gated behind a PIN stored in Script Properties (never in the repo).

**Actions supported:**

| Category | Actions |
|---|---|
| Auth | `pinStatus`, `verifyPin`, `changePin` |
| Events | `listEvents`, `getEventDetails`, `updateEvent`, `deleteEvent`, `publishEventToGitHub` |
| Gallery | `listGallery`, `saveGallery`, `deleteGalleryImage` |

After any event/gallery mutation, the script calls `rebuildFeed()` → `rebuildEventPages()` which regenerates `events-feed.js` and all `events/*.html` shells, then commits them back to the repo via the GitHub API.

### GitHub as Database

The Apps Script holds a GitHub fine-grained personal access token (Contents: read+write) in Script Properties. All content writes go directly to the repo via the GitHub REST API. This means:
- Every event publish, image upload, or deletion creates a commit on `main`.
- GitHub Actions then auto-deploys those changes to GitHub Pages within ~1 minute.
- The Git history is a complete audit log of all content changes.

---

## Service Worker (`sw.js`)

Cache version: `tact-v8`

| Resource type | Strategy |
|---|---|
| HTML, CSS, JS, JSON, events-feed.js, gallery.json | Network-first (cache on success, fall back to cache) |
| Images, media | Cache-first (serve from cache, fetch in background) |

The service worker immediately claims all open clients on activation (`clients.claim()`), which ensures updated assets are applied without requiring a manual refresh.

---

## Admin Interface (`admin.html`)

`admin.html` is a self-contained 79KB file with all styles inlined. It does not use `shared-ribbon.css` or any shared JS. Its responsibilities:

1. PIN authentication (POST to Apps Script)
2. Event creation form with image upload (compresses images in-browser before upload)
3. Event list with edit/delete
4. Gallery management per event
5. Trigger manual feed rebuilds

---

## Viewport & Scaling Notes

The site targets a fixed 1240px layout width. Narrow-viewport behavior:
- `<meta name="viewport" content="width=1240">` tells mobile browsers to render at 1240px logical width
- An inline `<script>` sets `html { zoom: <fraction> }` to scale the whole page down
- `position: fixed` elements (the nav dock) can exhibit browser-specific behavior under CSS `zoom`

---

## Dependency Graph

```
shared-ribbon.css          ← no dependencies
public-site.css            ← no dependencies (defines CSS vars)
<page>.css                 ← imports vars from public-site.css

site-chrome.js             ← reads shared-ribbon.css classes, no JS deps
page-router.js             ← depends on site-chrome.js being loaded first
events-feed-loader.js      ← injects <script> tag for events-feed.js
gallery-data.js            ← fetches data/gallery.json via fetch()
events-config.js           ← no deps (sets global)
event-page-paths.js        ← no deps (sets global)

<page>-page.js             ← depends on gallery-data.js / events-feed-loader.js
logo-belt.js               ← depends on logobelt/logobelt-manifest.js
```
