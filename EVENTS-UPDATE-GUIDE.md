# Event Update Guide (No Coding)

This website now uses a structured event system.

Main standard:
- Read: `EVENT-STRUCTURE.md`
- Do not manually edit generated feed unless needed:
  - `content/events/events-feed.js` (auto-generated)

## Add a new event

1. Create/update event folder under `content/events/`
2. Edit that folder's `event.json`
3. Add/replace poster and photos
4. Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/event-system.ps1 -Action normalize-photos
powershell -ExecutionPolicy Bypass -File tools/event-system.ps1 -Action build-feed
```

5. Commit and deploy

## Archive behavior

- If event date is today or future: it appears in **Upcoming Events**.
- If event date is in the past: it appears in **Past Events** automatically.

No manual archive step is needed.

## Folder structure per event

For each event, keep one folder in `content/events/`:

- `content/events/<event-slug>/poster.jpg`
- `content/events/<event-slug>/pre-event.txt`
- `content/events/<event-slug>/post-event.md` (fill after event)

`events-feed.js` is generated automatically from folder metadata.

## Event page

- Open `events.html`
- Events page: `events.html`
- Direct link to past events section: `events.html#past`

## Homepage behavior

- Homepage first shows normal intro.
- After 3 seconds, intro smoothly transitions to upcoming event slider.
