# Content Flow

How content enters the site, how it is stored, and how it reaches the browser.

---

## Event Publishing Flow

```
Admin fills form in admin.html
  │
  ▼
Browser compresses images (Canvas API, before upload)
  │
  ▼
POST to Google Apps Script (events-config.js → adminEndpoint)
  │
  ├─► Creates content/events/<slug>/event.json     (via GitHub API)
  ├─► Creates content/events/<slug>/poster.jpg     (via GitHub API)
  ├─► Creates content/events/<slug>/pre-event.txt  (via GitHub API)
  │
  ├─► rebuildFeed()
  │     └─► Collects all event.json files
  │     └─► Writes content/events/events-feed.js   (via GitHub API)
  │
  └─► rebuildEventPages()
        └─► For each event slug, writes events/<slug>.html  (via GitHub API)

GitHub receives the commits on `main`
  │
  ▼
GitHub Actions (static.yml) triggers
  │
  ▼
GitHub Pages re-deploys entire repo (~60 seconds)
  │
  ▼
Visitors see the new event
```

---

## Gallery Image Upload Flow

```
Admin selects images in admin.html (event already exists)
  │
  ▼
Browser: FileReader + Canvas resize/compress to JPEG
  │
  ▼
POST { action: "saveGallery", eventSlug, images: [{base64, filename, description}] }
  │
  ▼
Apps Script:
  ├─► Writes each image to content/events/<slug>/gallery/<filename>  (GitHub API)
  └─► Rebuilds data/gallery.json  (GitHub API)
        - Flattened array: one entry per event, with images[] sub-array
        - All program tags, dates, locations, page URLs included

GitHub Pages re-deploys
  │
  ▼
gallery.html, calendar.html, program pages show new images
```

---

## How a Page Loads Event Data

```
Browser loads events.html
  │
  ▼
site-chrome.js injects <header> and <footer> into DOM
  │
  ▼
page-router.js matches route → loads events-page.js
  │
  ▼
events-page.js calls loadTactEventFeed() from events-feed-loader.js
  │
  ▼
events-feed-loader.js injects <script src="content/events/events-feed.js">
  │
  ▼
events-feed.js executes: window.TACT_EVENT_FEED = [...]
  │
  ▼
events-page.js partitions events into upcoming / past
  │
  ▼
DOM is populated with event cards (poster, title, date, location)
  │
  ▼
Click on event card → navigate to events/<slug>.html
  │
  ▼
event-detail-page.js loads, reads slug from URL, finds event in TACT_EVENT_FEED
  │
  ▼
Renders two-column layout: poster + metadata + gallery images from gallery.json
```

---

## How Gallery Data Flows

```
data/gallery.json  (committed to repo, served statically)
  │
  ▼
gallery-data.js (fetch + in-memory cache, deduplicates parallel fetches)
  │
  ├─► gallery-page.js    → full image grid + modal
  ├─► calendar-page.js   → month view, images grouped by date
  ├─► program-page.js    → filtered by program tag (harate/aranya/etc.)
  └─► event-detail-page.js → images for a specific event slug
```

### gallery.json Structure

```json
[
  {
    "slug": "2026-science-day-mysuru",
    "program": "aranya",
    "eventSlug": "2026-science-day-mysuru",
    "pageUrl": "events/20-05-2026-science-day-mysuru.html",
    "title": "Science Day at Govt School",
    "date": "2026-05-20",
    "location": "Mysuru",
    "images": [
      {
        "url": "content/events/2026-science-day-mysuru/gallery/image-01.jpg",
        "description": "Students at the exhibit"
      }
    ]
  }
]
```

---

## Event Feed Structure

`content/events/events-feed.js` is a JS file (not JSON) that assigns a global:

```js
window.TACT_EVENT_FEED = [
  {
    "slug": "2026-science-day-mysuru",
    "title": "Science Day at Govt School",
    "date": "2026-05-20",
    "time": "10:00 AM – 1:00 PM",
    "location": "Mysuru",
    "teaser": "One-line summary for cards.",
    "homepageMatter": "Two to three lines shown on the homepage.",
    "status": "completed",    // or "scheduled"
    "program": "aranya",      // or harate, yuvati, nataka, mela, ""
    "poster": "content/events/2026-science-day-mysuru/poster.jpg"
  }
  // ...130 events total
]
```

It is loaded by injecting a `<script>` tag (not via `fetch()`), so it executes synchronously and sets the global before page initializers run.

---

## Content Directory Layout

```
content/events/
├── events-feed.js           ← AUTO-GENERATED — single source for all event metadata
│
├── 2026-science-day-mysuru/
│   ├── event.json           ← Canonical event metadata (source of truth)
│   ├── poster.jpg           ← Primary poster image
│   ├── pre-event.txt        ← Description shown before the event
│   ├── post-event.md        ← Write-up shown after the event (Markdown)
│   └── gallery/
│       ├── image-01.jpg
│       ├── image-02.jpg
│       └── ...
│
└── 2018-adarsha-vidyalaya/
    └── ...
```

**Slug naming convention:** `YYYY-short-descriptive-name` (all lowercase, hyphens only)

**event.json fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | Yes | Must match folder name |
| `title` | string | Yes | Full event title |
| `date` | string | Yes | ISO 8601 `YYYY-MM-DD` |
| `time` | string | No | Human-readable |
| `location` | string | Yes | City or venue name |
| `teaser` | string | Yes | One line for event cards |
| `homepageMatter` | string | No | 2–3 lines for homepage slider |
| `status` | string | Yes | `"scheduled"` or `"completed"` |
| `program` | string | No | `harate`, `aranya`, `yuvati`, `nataka`, `mela`, or `""` |

---

## Offline / Service Worker Flow

```
First visit:
  Browser ──► Network ──► GitHub Pages
  Service worker installs, caches HTML/CSS/JS/JSON

Subsequent visit:
  Browser ──► Service worker
                ├── HTML/CSS/JS: try network first, serve cache on failure
                └── Images:      serve cache first, fetch in background

Cache invalidation:
  - Version bump in sw.js (tact-v8 → tact-v9) triggers cache wipe on next visit
  - Versioned asset URLs (?v=20260501f) bypass stale caches at the HTTP layer
```

---

## Offline Event Management (Alternative Flow)

For environments without internet access to the Apps Script, `tools/event-system.ps1` provides equivalent PowerShell commands that operate directly on the file system:

```
event-system.ps1 init-event      → Creates content/events/<slug>/ folder structure
event-system.ps1 normalize-photos → Renames and organizes gallery images
event-system.ps1 build-feed      → Regenerates content/events/events-feed.js
event-system.ps1 validate        → Checks all event folders for required files
```

After running these scripts, the changes must be pushed to `main` to trigger deployment.

---

## Post-Event Description Fetch

Event detail pages fetch `content/events/<slug>/post-event.md` directly via `fetch()` after the initial render. This is the only async secondary fetch — all other data comes from the preloaded `TACT_EVENT_FEED` global or `gallery.json`.
