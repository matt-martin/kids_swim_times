# Swim Story

A small static dashboard that turns the Martin swimmers’ public meet results into a long-view story. Each event gets its own chart. 25-yard swims are solid; 50-yard swims are halved and dashed so the trend remains comparable across the distance change.

The dashboard opens in **Times** view, showing actual 25-yard and 50-yard results plus the dashed 50-yard-divided-by-two comparison. Use **Speed** to see yards per second so distances compare naturally. Individual medley events such as 100 IM remain a single raw-time series.

Charts shade alternating summers to make the seasonal gaps easy to scan. Hovering a point shows its recorded age and time-standard label when one exists. On touch devices, tapping a chart shows its basic tooltip; the synchronized hover guide and freeze control stay desktop-only.

All event charts for a selected kid share that kid’s full date range. Hovering any chart also draws a synchronized vertical guide across the other event charts.

Click a hovered date to freeze the guide across the charts; use any chart’s circular × control just below its x-axis to release it.

Event lines stay connected across meets where that event was not swum; the line bridges only the missing date slot and does not invent a data point.

Each event card also summarizes its best speed or best available 25-yard, 50-yard, and comparable times. Comparable time is shown only when both 25- and 50-yard distances are present.

Individual medley cards also report their best 100-yard time. Event badges use FR, BK, BR, FLY, and IM.

## Run it

```bash
npm install
npx playwright install chromium webkit   # first time only
npm run scrape                     # refresh public/data/swim-times.json
npm run dev
```

Then open the local URL printed by Vite. The site is static after the JSON file is generated, so `npm run build` produces a deployable `dist/` directory.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`. After pushing it to `main`, open **Settings → Pages** on GitHub and set **Source** to **GitHub Actions**. Future pushes to `main` will build and deploy the site at:

```text
https://matt-martin.github.io/kids_swim_times/
```

## Checks

```bash
npm test
npm run build
npm run test:e2e
```

The Playwright responsive test checks desktop Chromium, Android Chrome, desktop WebKit, and iPhone Safari profiles. Each run attaches a full-page screenshot to the test report and verifies that charts do not create horizontal overflow or extend beyond their cards.

The scraper lives in [`scripts/scrape.ts`](scripts/scrape.ts). It uses Playwright to load each Acorn Swim Database page, walks the site’s event sections, skips non-times such as DQs, normalizes dates and converted times, retains bronze/silver/gold time standards, and writes a readable checked-in JSON file. Standard-bearing results appear as colored stars in the charts. To add another swimmer, add a source entry to `SOURCES` and re-run `npm run scrape`.
