# JOMO 2.0

Mobile-first, web-only Expo schedule guide for offline festival use.

## Current Scope

- Expo + React Native Web + TypeScript.
- Bundled generated schedule data.
- Local search, day browsing, event details, and saved events.
- No accounts, backend, sync, or runtime PDF parsing.

## PDF Import

The source schedule material is `JOMO26_A4.pdf` at the project root. The app never reads that PDF at runtime. Instead, run:

```sh
npm run import:schedule
npm run audit:schedule
```

The importer extracts PDF text with `pdf2json`, normalizes the best-known event rows and camp/listing blocks, and writes `src/data/generatedSchedule.ts`.

Recommended workflow after changing the PDF or importer:

```sh
npm run import:schedule
npm run audit:schedule
npm run typecheck
npm run lint
npm run build:web
```

The audit reparses `JOMO26_A4.pdf` and compares raw PDF candidates against the generated schedule. It reports:

- total events and days
- raw PDF event/listing candidate coverage vs generated data
- per-day event counts
- `gridSquares` coverage
- `campHost` coverage
- unresolved, mystery, or not-decided locations
- swallowed/suspicious event descriptions
- malformed listing names
- listings without map-compatible grid/location
- out-of-map grid references such as `T28`
- duplicate-looking title/date/time entries

Saved-event IDs are derived from normalized date, time, location, and title content. If importer fixes change extracted title or location text, saved event IDs can churn and previously saved items in local storage may stop matching until the user re-saves them.

### Known Parser Limitations

This is a first-pass parser for a visual PDF, not a structured spreadsheet. It uses text positions and nearby day/time/category/location labels, so unusual PDF layout changes may need parser updates. Stable event IDs are generated from normalized date/time/location/title plus an ordinal suffix when needed; they are stable for the same extracted content.

## Useful Commands

```sh
npm run import:schedule
npm run audit:schedule
npm run typecheck
npm run lint
npm run build:web
npm run start
```
