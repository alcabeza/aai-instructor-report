# Maintenance

## When the portal changes

The extension relies on the portal's current layout. If AWS changes it, the report still opens and the yellow warning box names the tab that failed. Where to look in `extension/content.js`:

| Symptom | Likely cause | Where |
|---|---|---|
| Button does not appear | Tab names changed, so the page is not recognised | `isInstructorPage()`, `SUBTABS` |
| `tab "X" not found` | Tab renamed | the `step('X', …)` calls in `collectAll()` |
| A section is empty, no warning | Expected column header renamed | `readGrid('Header name')` and the `pick(o, '…')` calls |
| `read N of M rows` | Grid scrolling changed | scroll loop in `readGrid()` |
| Indicators missing | Progress wording changed | regular expression in `readProgress()` |
| Name or statuses missing | Profile block changed | `readProfile()` |

To test a fix: open the portal with the extension loaded, open DevTools on the portal tab, click the button and watch the console (`[AAI report]` errors). After editing, click **Reload** on the extension card and reload the portal page.

## Changing thresholds and colours

- CSAT threshold, red floor and certification warning window: constants at the top of `extension/dashboard.js` (`CSAT_THRESHOLD`, `CSAT_FLOOR`, `SOON_DAYS`).
- Colours: CSS variables at the top of `extension/dashboard.css`, light and dark.
- Wording of the report: `extension/dashboard.html` (static text) and `extension/dashboard.js` (text that depends on data).

Check the result without the portal:

```bash
python3 tests/preview/make_sample.py
python3 tests/preview/render.py
```

The script fails if the page throws an error and writes screenshots to `tests/preview/out/`. To refresh the documentation screenshots, use `--out docs/images`.

## Releasing a version

1. Increase `version` in `extension/manifest.json` (semantic versioning).
2. Add an entry to `CHANGELOG.md`.
3. Run `scripts/build.sh`. It writes `dist/aai-instructor-report-extension-vX.Y.Z.zip` and `dist/AAI-Report-Installer-vX.Y.Z.zip`.
4. Commit, tag `vX.Y.Z`, push, then create a GitHub release with both zips attached:

```bash
git tag v1.1.0 && git push --tags
gh release create v1.1.0 dist/*.zip --title "v1.1.0" --notes-file <(sed -n '/## \[1.1.0\]/,/## \[/p' CHANGELOG.md | sed '$d')
```

## Updating D3

`extension/d3.min.js` is D3 v7 copied from the `d3` npm package (`node_modules/d3/dist/d3.min.js`). Manifest V3 does not allow loading it from a CDN.
