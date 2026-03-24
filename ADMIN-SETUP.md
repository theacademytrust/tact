# Admin Form Setup

This project uses a Google Apps Script web app as a small authenticated backend for `admin.html`.
The backend publishes event content directly into the GitHub repo. Google Drive and Google Sheets are not used in the current flow.

## 1) Deploy the Apps Script backend

1. Open [script.google.com](https://script.google.com) and create a new project.
2. Replace the default script with:
   - `backend/google-apps-script/Code.gs`
3. In `Project Settings -> Script properties`, add:
   - `ADMIN_PIN`
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_BRANCH`
   - `GITHUB_EVENTS_ROOT`
4. Recommended values:
   - `GITHUB_OWNER=theacademytrust`
   - `GITHUB_REPO=tact`
   - `GITHUB_BRANCH=main`
   - `GITHUB_EVENTS_ROOT=content/events`
5. Deploy as a web app:
   - `Deploy -> New deployment -> Web app`
   - Execute as: `Me`
   - Who has access: `Anyone`
6. Copy the web app URL ending in `/exec`.

## 2) Create the GitHub token

Create a fine-grained GitHub personal access token with access only to this repo:

1. GitHub -> `Settings`
2. `Developer settings`
3. `Personal access tokens`
4. `Fine-grained tokens`
5. `Generate new token`
6. Repository access: `Only select repositories` -> `tact`
7. Repository permissions:
   - `Contents`: `Read and write`
   - `Metadata`: `Read`
8. Copy the token and save it in Apps Script as `GITHUB_TOKEN`

Do not share the token in screenshots or messages. If exposed, revoke it and create a new one.

## 3) Authorize Apps Script once

The script needs permission to call the GitHub API with `UrlFetchApp`.

Add this helper temporarily to the end of `Code.gs`:

```javascript
function authorizeUrlFetch() {
  UrlFetchApp.fetch("https://api.github.com", { muteHttpExceptions: true });
}
```

Then:

1. Save the script
2. Select `authorizeUrlFetch` from the function dropdown
3. Click `Run`
4. Complete the Google authorization flow
5. Redeploy the web app

You can remove the helper later if you want.

## 4) Configure the website

1. Open `assets/js/events-config.js`
2. Set `apiEndpoint` to your Apps Script web app URL
3. Publish the site with GitHub Pages or another static host

Admin URL:
- `https://<username>.github.io/<repo>/admin.html`

## 5) What submit does

Submitting the admin form writes directly to:

- `content/events/<slug>/event.json`
- `content/events/<slug>/pre-event.txt`
- `content/events/<slug>/post-event.md`
- `content/events/<slug>/poster.*`
- `content/events/events-feed.js`

The website reads from repo content, so new events appear after the repo updates are published.

## 6) Current admin UX

- Unlock with the admin PIN first
- Pressing `Enter` in the PIN field works the same as clicking `Unlock Form`
- Event time is entered with separate `From Time` and `To Time` fields
- After a successful submit, `admin.html` refreshes so the form is cleared
- `Manage Existing Events` loads the current event list from GitHub with poster preview, title, date, and delete controls
- Deleting an event removes the full `content/events/<slug>/` folder and rebuilds `content/events/events-feed.js`

## 7) PIN behavior

- Use `admin.html` to verify the PIN before unlocking the form
- If no PIN exists yet, you can set the first PIN from the admin page
- If a PIN already exists, the old PIN is required to change it
- PIN must be at least 4 digits

## 8) Local testing

You can test the static site locally from the repo root:

```bash
python -m http.server 8080
```

Open:

- `http://localhost:8080/admin.html`
- `http://localhost:8080/index.html`

## Important

- The backend checks the PIN in Apps Script, not in the browser
- Keep the Apps Script web app URL private where possible
- After editing `Code.gs`, redeploy the web app
- The current backend does not use Google Drive or Google Sheets
- Required Apps Script properties are documented at the top of `backend/google-apps-script/Code.gs`
