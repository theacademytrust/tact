# Deployment

## How It Works

There is no build step. Deployment is:

```
git push origin main  →  GitHub Actions triggers  →  GitHub Pages publishes
```

The entire repository is deployed as-is. No compilation, bundling, or transpilation occurs. The GitHub Actions workflow (`.github/workflows/static.yml`) uses the standard `actions/deploy-pages` action, which zips the repo and publishes it to GitHub Pages.

Typical propagation time: **~60 seconds** after push.

---

## Environment Summary

| Component | Where it runs | How to update |
|---|---|---|
| Static site files | GitHub Pages | `git push origin main` |
| Google Apps Script | Google's servers | Edit `backend/google-apps-script/Code.gs`, deploy from Apps Script editor |
| Service Worker | Browser | Bump version string in `sw.js` |

---

## GitHub Actions Workflow

File: `.github/workflows/static.yml`

```yaml
on:
  push:
    branches: ["main"]
  workflow_dispatch:    # allows manual trigger from GitHub UI

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: "."
      - uses: actions/deploy-pages@v4
```

No Node.js, no npm install, no build commands. The entire repository root is uploaded.

---

## Google Apps Script Backend

The backend is **separately deployed** from the static site.

### Initial Setup

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Paste the contents of `backend/google-apps-script/Code.gs`.
3. In **Project Settings → Script Properties**, add:

| Property | Value |
|---|---|
| `ADMIN_PIN` | A 4+ digit PIN |
| `GITHUB_TOKEN` | Fine-grained PAT (Contents: read+write on the repo) |
| `GITHUB_OWNER` | GitHub username/org |
| `GITHUB_REPO` | Repository name |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_EVENTS_ROOT` | `content/events` |
| `GITHUB_EVENT_PAGES_ROOT` | `events` |
| `GITHUB_GALLERY_DATA_PATH` | `data/gallery.json` |
| `GITHUB_GALLERY_IMAGES_ROOT` | `images/gallery` |

4. **Deploy → New deployment** as a Web App:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL.

### Wiring the URL into the Site

Open `assets/js/events-config.js` and replace the `adminEndpoint` value:

```js
window.TACT_EVENTS_CONFIG = window.TACT_EVENTS_CONFIG || {
  apiEndpoint: "",
  adminEndpoint: "https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec",
  requestTimeoutMs: 10000
};
```

Commit and push. The admin page now communicates with the correct backend.

### Updating the Backend

After editing `Code.gs`:
1. In the Apps Script editor: **Deploy → Manage deployments**
2. Click the pencil icon on the active deployment
3. Set Version to **"New version"**
4. Click **Deploy**

The URL does not change between version updates.

---

## Service Worker Cache Invalidation

The service worker caches CSS, JS, HTML, and JSON aggressively. When making significant changes:

1. Open `sw.js`
2. Increment the cache version: `const CACHE_VERSION = 'tact-v9';` (or whatever the next number is)
3. Update the precache list if new critical assets were added
4. Commit and push

On the next page load, the browser will install the new service worker, wipe the old cache, and refetch everything.

**Asset-level cache busting** (for individual files) is handled by the `?v=YYYYMMDDX` suffix on script and stylesheet `<script>`/`<link>` tags. Update these manually in the HTML files when an asset changes.

---

## Local Development

Because there is no build step, local development is straightforward:

```bash
# Serve from root with any static server
npx serve .
# or
python3 -m http.server 8080
# or
npx http-server . -p 8080
```

Then open `http://localhost:8080`.

**Caveats:**
- The admin panel (`admin.html`) will make requests to the live Google Apps Script endpoint. Changes made locally will still commit to the real repo.
- The service worker does not activate on `localhost` by default in most browsers (Chrome exempts `localhost`; others may not).
- Image paths are relative, so all pages work correctly from the root.

### Regenerating Event Pages Locally

If `content/events/` is modified locally without using the admin panel:

```bash
# Regenerate all events/*.html shells
node tools/generate-event-pages.mjs

# Regenerate logobelt/logobelt-manifest.js
node tools/generate-logo-belt-manifest.mjs
```

Requires Node.js 18+ (ES modules, `node:fs/promises`, `node:path`).

### PowerShell Tools

On Windows (or with PowerShell Core on Linux/Mac):

```powershell
# Create a new event folder
.\tools\event-system.ps1 init-event -slug "2026-my-event" -title "My Event"

# Organize gallery photos
.\tools\event-system.ps1 normalize-photos -slug "2026-my-event"

# Rebuild the event feed JS
.\tools\event-system.ps1 build-feed

# Validate all event folders
.\tools\event-system.ps1 validate
```

---

## Alternative Hosting Targets

The site can be hosted on any static file server.

### Netlify / Vercel

1. Connect the GitHub repo.
2. Set publish directory to `/` (root).
3. No build command.
4. Deploy on push to `main`.

### Traditional Web Hosting (Apache)

The included `.htaccess` configures:
- Gzip compression for text, CSS, JS
- `Cache-Control` headers (1 year for assets, 1 month for HTML)
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`)
- HTTPS redirect
- `Service-Worker-Allowed: /` header

Upload all files to the server's document root. The `.htaccess` will be picked up automatically by Apache.

---

## Potential Issues

### Service Worker on First Deploy to New Domain

If the site moves to a new domain, visitors with a cached service worker from the old origin will be unaffected (different origin = different service worker). But the first visit on the new domain will not have any cache. This is fine — the service worker installs on first visit.

### GitHub Token Expiry

The `GITHUB_TOKEN` in Apps Script Script Properties is a personal access token. If it expires or is revoked, all admin operations (event publish, image upload, gallery management) will silently fail. Check the Apps Script execution logs if the admin panel stops working.

### Apps Script Quotas

Google Apps Script has daily execution quotas. For a non-profits-scale site with infrequent admin use, these are unlikely to be hit. If they are, the Apps Script editor shows quota usage under **View → Executions**.

### Manual Version Stamp Discipline

Forgetting to update `?v=YYYYMMDDX` in HTML files after changing a CSS or JS file will leave some visitors on the old cached version until the service worker refreshes them. The service worker's network-first strategy for JS/CSS mitigates this — but only for users whose service worker has already installed.
