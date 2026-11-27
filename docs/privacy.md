# Privacy and security

## Summary

- The extension only runs on `https://portal.aai.aws.training/*`.
- It reads the dashboard of the instructor who is signed in, using their existing portal session. It never asks for or handles credentials.
- The collected data stays in the browser, in the extension's local storage (`chrome.storage.local`). There is no server, analytics or third-party call.
- It does not change anything on the portal: it only clicks tabs and reads what they display.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Keep the last report so the report page can display it and reopen it later |
| Host `https://portal.aai.aws.training/*` | Inject the content script (button and reading) on the portal only |

No `tabs`, `history`, `cookies`, `webRequest` or `<all_urls>` permission is requested.

## Data read

Name, geo, region, instructor type and statuses; provider; session list (course, end date, learners, CSAT, response rate); yearly indicators and badges; approved and ramping courses; certifications and expiry dates. See [data-model.md](data-model.md).

## Where the data goes

- `chrome.storage.local` of the Chrome profile, overwritten at each new report. Removing the extension deletes it.
- Files the user explicitly creates: a PDF (Print) or a JSON export.

## Code safety

- D3 is bundled locally. No remote script is loaded.
- Portal text is inserted with `textContent` only, so content from the page cannot inject HTML or script into the report.

## Privacy statement (for a Chrome Web Store listing)

> AAI Instructor Report reads the instructor dashboard of the user signed in to the AWS AAI portal, only when the user clicks its button, to display a visual report. The data is stored only in the user's browser and is never transmitted to the developer or any third party. The extension does not collect analytics.
