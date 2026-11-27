# Architecture

## Components

| File | Role |
|---|---|
| `extension/manifest.json` | Manifest V3. Permission `storage`; host permission limited to `https://portal.aai.aws.training/*`. |
| `extension/content.js` | Content script on the portal. Injects the button, walks through the tabs, reads the data. |
| `extension/content.css` | Style of the floating button. |
| `extension/background.js` | Service worker. Stores the collected data and opens the report tab; handles the toolbar icon. |
| `extension/dashboard.html` / `.css` / `.js` | The report page, an extension page (`chrome-extension://…/dashboard.html`). |
| `extension/d3.min.js` | D3 v7, bundled locally (Manifest V3 forbids remote code). |

## Data flow

```
AAI portal page (signed-in instructor)
   │  content.js: click tabs, read grids and text
   ▼
data object (see data-model.md)
   │  chrome.runtime.sendMessage({type: 'aai-open', data})
   ▼
background.js ── chrome.storage.local.set({aaiData}) ── chrome.tabs.create(dashboard.html)
                                                              │
                                                              ▼
                                   dashboard.js: chrome.storage.local.get('aaiData') → render
```

The toolbar icon sends `{type: 'aai-run'}` to the content script when the active tab is the portal. Elsewhere it reopens `dashboard.html`.

## How the portal is read

The portal is a single-page app. The *Technical Instructor* page has a row of tabs (`[role=tab]`). Most tabs display a data grid built with ARIA roles (`[role=grid]`, `[role=row]`, `[role=columnheader]`, `[role=gridcell]`).

For each tab, `content.js`:

1. clicks the tab whose text matches (`Delivery CSAT`, `Progress`, `Approved Courses`, `Ramping Courses`, `Certifications`, `Providers`), then waits until it is selected and its heading is shown;
2. finds the grid whose column headers include an expected header (for example `Instructor csat score` for Delivery CSAT);
3. reads every row. The grid is **virtualised**: only visible rows exist in the DOM. The script therefore scrolls the grid's scroll container step by step, collects rows at each step and de-duplicates them (by `aria-rowindex` or by content);
4. maps cells to columns by header text, so a reordering of columns does not break the mapping;
5. compares the number of rows read with the grid footer (`N results`) and records a warning if some are missing.

Non-grid data:

- **Profile:** name from the heading `Name - GEO`; Geo, Region and Type from the label/value pairs; status checkboxes (Champion, Freelancer, Alumni) from `input[type=checkbox]` and their nearest label text.
- **Progress:** regular expressions on the tab text (`Year to Date: CSAT = …, from … survey responses …`), plus the badge lists (lines starting with ✅).

Dates such as `Nov 25, 2026` are converted to ISO `2026-11-25`. Numbers are parsed from text (`%` removed).

At the end the script clicks back to the tab the user started on.

## Report rendering

`dashboard.js` is plain JavaScript with D3 for the SVG charts. All text is inserted with `textContent` (no HTML injection from portal data). Charts are redrawn on window resize, year change, colour scheme change and before printing.

Key constants at the top of `dashboard.js`:

| Constant | Value | Meaning |
|---|---|---|
| `CSAT_THRESHOLD` | 4.75 | Minimum CSAT to remain an instructor: green at or above, threshold line on the chart |
| `CSAT_FLOOR` | 4.0 | At or below this, CSAT colour is fully red |
| `SOON_DAYS` | 183 | Certifications expiring within this many days are highlighted |

Colours are CSS variables in `dashboard.css` (`--ok`, `--orange`, `--bad`, …), with a dark-mode variant.
