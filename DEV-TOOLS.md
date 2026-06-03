# Dev Tools — tAcT Website

Tools installed for checking and testing the website locally without needing a browser open.

---

## Installed Packages

| Package | What it does |
|---|---|
| `playwright` | Launches a headless Chromium browser — take screenshots, check page rendering, verify assets load |
| `html-validate` | Validates HTML files for broken markup, missing attributes, accessibility issues |

Install them (already done, but run this after a fresh clone):

```bash
cd website
npm install
npx playwright install chromium
```

---

## Take a Screenshot of Any Page

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:8080/index.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/check.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to /tmp/check.png');
})();
"
```

Change `index.html` to any page (e.g. `i2.html`, `vijnana-yuvati.html`).

---

## Check for Broken Asset Requests

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', req => failed.push(req.url()));
  await page.goto('http://localhost:8080/index.html');
  await page.waitForTimeout(2000);
  if (failed.length) { console.log('BROKEN:', failed); }
  else { console.log('All assets loaded OK'); }
  await browser.close();
})();
"
```

---

## Validate HTML

```bash
npx html-validate index.html
npx html-validate i2.html i3.html
```

---

## Start the Local Server

```bash
cd website
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

---

## Files in This Folder

| File | Description |
|---|---|
| `index.html` | Live homepage (production version) |
| `i2.html` | Homepage draft — deeper color palette, Mac-dock nav style, events tracker |
| `i3.html` | Homepage draft — with Documents & Governance section, founding members |
| `vijnana-*.html` | Individual outreach programme pages |
| `ganitha-mela.html` | Ganitha Mela programme page |
| `assets/css/program-page.css` | Shared CSS for all outreach programme pages |
