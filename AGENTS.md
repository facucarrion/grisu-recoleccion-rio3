# AGENTS.md

## What this is

A waste collection schedule lookup tool for Río Tercero, Córdoba. Two apps share the same data:

- **CLI** (`index.js`) — Node.js search prompt using `@inquirer/prompts`
- **Web** (`web/`) — Vanilla HTML/CSS/JS, open `web/index.html` directly in a browser

## Commands

| Action | Command |
|--------|---------|
| Run CLI | `npm start` |
| Run web | Open `web/index.html` in browser (no server needed) |

Package is ESM (`"type": "module"`). Single dependency: `@inquirer/prompts`.

No lint, test, typecheck, or build tooling is configured.

## Data duplication — the main gotcha

The same schedule data lives in **three** places that must be kept in sync:

1. `data.json` — used by the CLI
2. `web/data.js` — used by the web app (embedded as a JS `const DATA = ...`)
3. `info.txt` — human-readable reference

When adding/editing schedules, all three must be updated. The web copy uses `"06:00 a 14:00"` format in `timeRanges` while the CLI uses `"06:00 - 14:00"`.

## Architecture notes

- `index.js` parses `data.json`, builds a `neighborhoodIndex` Map, then presents an `@inquirer/search` prompt with fuzzy accent-insensitive matching
- `web/app.js` does the same logic directly from the `DATA` global in `data.js`
- `info.txt` is the source document the data was transcribed from — it's not consumed by code
- Waste type order across both apps: `húmedos` → `verdes_inertes_voluminosos` → `reciclables_secos`
- `.gitignore` intentionally excludes `package-lock.json` (not a mistake)
