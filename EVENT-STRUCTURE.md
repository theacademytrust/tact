# Event Storage Standard (Future-Proof)

This is the canonical event structure for this project.

## Folder naming

- Pattern: `YYYY-MM-DD--event-slug`
- Example: `2026-05-20--science-day-mysuru`

## Required files per event folder

- `event.json` (metadata)
- `poster.jpg` or `poster.png` or `poster.webp` or `poster.svg`
- `pre-event.txt`
- `post-event.md`
- `gallery/` (auto-named final images)
- `raw/` (drop photos here before normalization)

## Metadata format (`event.json`)

```json
{
  "slug": "2026-05-20--science-day-mysuru",
  "title": "Science Day at Govt School",
  "date": "2026-05-20",
  "time": "10:00 AM - 1:00 PM",
  "location": "Mysuru",
  "teaser": "One-line summary",
  "homepageMatter": "Two to three lines for homepage.",
  "status": "scheduled"
}
```

## Auto photo naming

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/event-system.ps1 -Action normalize-photos
```

Behavior:
- If poster missing, first image in `raw/` becomes `poster.*`
- Remaining images become:
  - `gallery/<event-folder-name>-001.jpg`
  - `gallery/<event-folder-name>-002.jpg`
  - etc.

## Auto feed generation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/event-system.ps1 -Action build-feed
```

This generates:

- `content/events/events-feed.js`

The website reads this feed automatically for homepage/events page.

## Create a new event quickly

```powershell
powershell -ExecutionPolicy Bypass -File tools/event-system.ps1 -Action init-event -Slug 2026-05-20--science-day-mysuru -Title \"Science Day\" -Date 2026-05-20 -Time \"10:00 AM - 1:00 PM\" -Location Mysuru
```

Then:
1. Drop photos into `raw/`
2. Update `event.json` text
3. Run `normalize-photos`
4. Run `build-feed`
