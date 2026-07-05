# JOMO 2.0

Mobile-first, web-only Expo schedule guide for offline festival use.

## Current Scope

- Expo + React Native Web + TypeScript.
- Bundled generated schedule data.
- Local search, day browsing, event details, and saved events.
- No accounts, backend, sync, or runtime PDF parsing.

## PDF Import

The source schedule material is `guide_A4_preview.pdf` at the project root. The app never reads that PDF at runtime. Instead, run:

```sh
npm run import:schedule
```

The importer extracts PDF text with `pdf2json`, normalizes the best-known event rows, and writes `src/data/generatedSchedule.ts`.

### Known Parser Limitations

This is a first-pass parser for a visual PDF, not a structured spreadsheet. It uses text positions and nearby day/time/category/location labels, so unusual PDF layout changes may need parser updates. Stable event IDs are generated from normalized date/time/location/title plus an ordinal suffix when needed; they are stable for the same extracted content.

## Useful Commands

```sh
npm run import:schedule
npm run typecheck
npm run lint
npm run build:web
npm run start
```
