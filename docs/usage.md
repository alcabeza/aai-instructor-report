# Usage

## Generating a report

1. Sign in to the AAI portal and open your **Technical Instructor** page.
2. Click **📊 My AAI report** at the bottom right (or the extension icon in the toolbar).
3. Do not use the page while the button shows progress (*Reading sessions…*, *Reading certifications…*). The extension clicks through the tabs for 15 to 30 seconds, then returns to the tab you were on.
4. The report opens in a new tab next to the portal.

The report always shows **the data of the account signed in to the portal** at the time of the click. Nothing is hard-coded: each instructor who runs the extension gets their own report.

Clicking the extension icon on any other site reopens the last report generated in this Chrome profile.

## Reading the report

- **Year selector** (top left): changes the month, CSAT, course and indicator sections. The year-over-year chart always shows every year.
- **Indicators:**
  - For the current year, CSAT, survey responses, response rate and delivery days are the **official** figures of the portal's *Progress* tab (year to date), compared with the previous year.
  - For the previous year, they are the portal's *Previous Year* figures.
  - For older years, the portal gives no official figures: the report shows the average CSAT of rated sessions instead.
  - Sessions and learners are counted from the *Delivery CSAT* table.
- **CSAT colours:** green at 4.75 or above. Below that, from orange (just under 4.75) to red (4.0 or lower).
- **CSAT per session:** the dashed red line is the 4.75 threshold to remain an instructor. The shaded area is below it. Dot size follows the number of learners. Hover a dot for details.
- **Certifications:** the *Days* column counts days until expiry from today. Orange means within 6 months.
- **Catalogue:** "Discovery Day" formats are excluded from the delivered/never-delivered split.
- **Warnings:** if a tab could not be read completely, a yellow box under the summary names it.

## Sharing

- **Print / PDF:** opens Chrome's print dialog. Choose *Save as PDF*. The toolbar is hidden in print.
- **Export data (JSON):** downloads the raw data read from the portal (see [data-model.md](data-model.md)), for example to keep a yearly snapshot.

The report and the exported files contain personal data (name, scores, certifications). Share them deliberately.

## Shared computers

The last report is stored per Chrome profile. If two instructors use the same Chrome profile, *reopen last report* shows whoever clicked last. Generating a new report from the portal always reads the signed-in account.
