# Tact

Tact is a static site for The Academy Trust with a GitHub-backed admin workflow for publishing events and gallery content.

## What the site now includes

- Event publishing through `admin.html`
- Event-linked gallery publishing through `admin.html`
- Dedicated standalone event pages under `events/<slug>.html`
- A standalone image gallery page at `gallery.html`
- A calendar view for gallery content at `calendar.html`
- Shared site navigation through `assets/js/site-chrome.js`
- Shared public-site typography, spacing, cards, buttons, and footer through `assets/css/public-site.css`
- Client-side route handling through `assets/js/page-router.js`

## Admin workflow

The admin interface lives in [admin.html](/home/chi/Tact/admin.html).

### PIN access

- The admin page is locked behind a PIN
- PIN verification and PIN changes are handled by the Google Apps Script backend
- The unlocked PIN session is reused for event publishing, gallery publishing, and event deletion

### Event publishing

The existing event flow is still supported.

- Title, date, time range, location, status, description, and poster image are entered in the event form
- The form submits to the Apps Script endpoint configured in [assets/js/events-config.js](/home/chi/Tact/assets/js/events-config.js)
- The backend writes event content into `content/events/<slug>/`
- The backend rebuilds `content/events/events-feed.js`
- `Manage Existing Events` shows current GitHub-backed event entries and allows deletion
- Successful saves clear the form and remove the saved local draft
- Unsaved event draft data is stored locally and restored when the page is reopened

### Gallery publishing

The same admin page now includes a second mode: `Add Gallery`.

- Event selection:
  - Pick from previously created GitHub-backed events
  - The selected event's existing gallery images are shown first
- Dynamic gallery blocks:
  - Image upload
  - Description
  - Preview before upload
  - Remove button per block
- `Add More Images` keeps appending the next sequential image block
- At least one image is required
- Every image requires a description
- Gallery saves append new images to the selected event instead of creating a separate standalone gallery record
- Raster images are automatically compressed in the browser before upload across event and gallery flows
- Compression is multi-step and balanced:
  - resizes large images progressively
  - lowers quality only as much as needed
  - aims to avoid GitHub/API upload failures while keeping acceptable clarity
- Successful saves clear the form and remove the saved local draft
- Unsaved gallery draft data is stored locally and restored when the page is reopened

Gallery submissions use this structure:

```json
{
  "slug": "2026-04-05-event-title",
  "eventSlug": "2026-04-05-event-title",
  "pageUrl": "events/2026-04-05-event-title.html",
  "title": "Event Title",
  "date": "2026-04-05",
  "location": "Bangalore",
  "images": [
    {
      "url": "content/events/2026-04-05-event-title/gallery/image-01.jpg",
      "description": "desc1"
    },
    {
      "url": "content/events/2026-04-05-event-title/gallery/image-02.jpg",
      "description": "desc2"
    }
  ]
}
```

Published gallery data is stored in:

- [data/gallery.json](/home/chi/Tact/data/gallery.json)

Published gallery images are stored inside each event folder:

- `content/events/<slug>/gallery/`

## Event detail pages

Each event now has a dedicated static HTML page.

Supporting files:

- [assets/css/event-detail.css](/home/tact/tact/assets/css/event-detail.css)
- [assets/js/event-detail-page.js](/home/tact/tact/assets/js/event-detail-page.js)
- [tools/generate-event-pages.mjs](/home/tact/tact/tools/generate-event-pages.mjs)
- [events/](/home/tact/tact/events)

Behavior:

- Every event page uses the same ribbon header and footer as the rest of the site
- The top section uses a two-column layout with an A4-style poster on the left and event metadata plus full description on the right
- The poster opens in the same modal pattern used by `gallery.html`
- A gallery grid below the top card shows all event-linked gallery images
- Gallery cards reuse the same hover overlay and modal behavior as `gallery.html`
- `events.html` past-event cards link directly to the corresponding `events/<slug>.html` page

## Gallery page

The gallery frontend lives in [gallery.html](/home/chi/Tact/gallery.html).

Supporting files:

- [assets/css/gallery.css](/home/chi/Tact/assets/css/gallery.css)
- [assets/js/gallery-data.js](/home/chi/Tact/assets/js/gallery-data.js)
- [assets/js/gallery-page.js](/home/chi/Tact/assets/js/gallery-page.js)

Behavior:

- Reuses the shared site header and footer styling
- Reads gallery data from `data/gallery.json`
- Flattens gallery entries into an image-only responsive grid
- Loads the first batch, then loads more images on scroll using `IntersectionObserver`
- Uses delegated click handling on the gallery grid so dynamically rendered cards open the modal reliably on first load
- Shows hover overlays with title, date, location, and short description
- Opens a large in-page modal with full image and full metadata
- Uses lazy-loaded images and in-page modals without URL changes

## Calendar page

The calendar frontend lives in [calendar.html](/home/chi/Tact/calendar.html).

Supporting files:

- [assets/css/calendar.css](/home/chi/Tact/assets/css/calendar.css)
- [assets/js/gallery-data.js](/home/chi/Tact/assets/js/gallery-data.js)
- [assets/js/calendar-page.js](/home/chi/Tact/assets/js/calendar-page.js)

Behavior:

- Reuses the shared site header and footer styling
- Reads the same gallery data source as `gallery.html`
- Renders a month grid with previous/next month controls
- Groups gallery images by date
- Shows rotating image previews inside date cells when that date has gallery images
- Uses delegated click handling for both the month grid and the date modal grid so both modal levels work reliably on first load
- Shows hover overlays with title, date, location, and short description
- Opens a first modal with all images for the selected date
- Opens a second modal with the selected full-size image and full metadata
- Keeps all navigation inside the current page without URL changes

## Backend

The current backend is a Google Apps Script web app that writes directly to GitHub.

Source:

- [backend/google-apps-script/Code.gs](/home/chi/Tact/backend/google-apps-script/Code.gs)

The backend now supports:

- `pinStatus`
- `verifyPin`
- `changePin`
- `listEvents`
- `deleteEvent`
- event publishing
- `listGallery`
- `saveGallery`

For gallery publishing, the backend:

- validates the selected event and new images
- uploads gallery image files into `content/events/<slug>/gallery/`
- updates `data/gallery.json`
- appends new images to the selected event's gallery entry
- generates or refreshes `events/<slug>.html` whenever the event feed is rebuilt
- removes the generated event page and gallery entry when an event is deleted

## Shared frontend wiring

Shared navigation and routing were updated so the new pages behave like the existing site.

- [assets/css/public-site.css](/home/chi/Tact/assets/css/public-site.css)
  - Centralizes public-page typography, spacing, card, button, wrap, and footer rules
- [assets/js/site-chrome.js](/home/chi/Tact/assets/js/site-chrome.js)
  - Adds `Gallery` and `Calendar` links under `Events & Media`
  - Renders the shared ribbon header and shared footer
  - Resolves shared navigation links correctly from both root pages and generated `events/<slug>.html` pages
  - Keeps dropdown behavior stable across routed page reinitialization without stacking duplicate document listeners
  - Is loaded with a versioned asset URL on public pages so shared header fixes are not blocked by stale browser cache
- [assets/js/page-router.js](/home/chi/Tact/assets/js/page-router.js)
  - Registers `gallery.html` and `calendar.html`
  - Loads the right scripts for those routes
  - Runs the correct page initializer on route changes
  - Uses versioned gallery/calendar asset URLs so new modal logic is not blocked by stale browser cache
  - Reuses the same runtime initializers after client-side navigation instead of rebinding per-card handlers
  - Intentionally bypasses client-side routing for `gallery.html` and `calendar.html` so those pages always load fresh page HTML and page-specific modal code directly
- [sw.js](/home/chi/Tact/sw.js)
  - Uses network-first fetches for HTML, CSS, JS, JSON, the event feed, and `gallery.json`
  - Claims updated clients immediately so gallery/calendar modal fixes do not depend on a hard refresh
  - Leaves static media on normal cache-backed behavior

## Events page integration

- `Past Events` cards in [events.html](/home/tact/tact/events.html) are now clickable links
- Each card opens the matching generated event page under `events/<slug>.html`
- Event-detail pages load from the shared event feed plus `data/gallery.json`, so navigation stays aligned with published repo content

## Desktop-only presentation

- Public pages are intentionally locked to a desktop layout
- Small screens keep the desktop grid, spacing, typography, and header/footer behavior instead of switching to stacked mobile layouts
- Mobile `max-width` breakpoint rules have been removed from the public page styling layer rather than only being overridden later
- Public HTML pages use a fixed `width=1240` viewport so mobile browsers scale the desktop layout down on first load instead of opening zoomed in
- The current desktop-only lock is applied through:
  - [assets/css/public-site.css](/home/chi/Tact/assets/css/public-site.css)
  - [shared-ribbon.css](/home/chi/Tact/shared-ribbon.css)
  - [assets/css/events.css](/home/chi/Tact/assets/css/events.css)
  - [assets/css/gallery.css](/home/chi/Tact/assets/css/gallery.css)
  - [assets/css/calendar.css](/home/chi/Tact/assets/css/calendar.css)
  - [assets/css/program-page.css](/home/chi/Tact/assets/css/program-page.css)
  - [index.html](/home/chi/Tact/index.html)
  - [donate.html](/home/chi/Tact/donate.html)

## Landing page loading

- [index.html](/home/chi/Tact/index.html), [assets/js/index-page.js](/home/chi/Tact/assets/js/index-page.js), and [assets/js/home-events-board.js](/home/chi/Tact/assets/js/home-events-board.js) are tuned for better first paint.
- The current approach:
  - preloads and prioritizes the first hero image
  - avoids lazy loading for the first visible hero frames
  - reveals the hero slideshow after the first image is decoded to reduce visible partial rendering
  - renders the home events board immediately from the local feed snapshot, then refreshes from async data
  - lazy-loads lower-priority showcase images further down the page

## Deployment notes

If gallery save fails with `Missing required event fields.`, the live Apps Script deployment is still using the old event-only code. Redeploy [backend/google-apps-script/Code.gs](/home/chi/Tact/backend/google-apps-script/Code.gs).

If gallery save fails with a GitHub bandwidth / transfer quota error, the admin page now compresses large raster images before upload, but very large source files may still require smaller uploads.

If new event pages or event-linked gallery behavior do not appear in production, redeploy the live Apps Script project from [backend/google-apps-script/Code.gs](/home/tact/tact/backend/google-apps-script/Code.gs) so the generated page and gallery logic matches this repo version.

## Maintenance

- When adding or refining major site behavior, pages, admin flows, or backend actions, update this `README.md` in the same change.
- Keep the README aligned with the current live architecture for:
  - `admin.html`
  - `gallery.html`
  - `calendar.html`
  - shared public styles and shared chrome/footer behavior
  - Apps Script backend actions
  - storage paths and deployment notes

## Setup references

- [ADMIN-SETUP.md](/home/chi/Tact/ADMIN-SETUP.md)
- [DEPLOYMENT.md](/home/chi/Tact/DEPLOYMENT.md)
