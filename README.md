# Swim Story

A small static dashboard that turns the Martin swimmers’ public meet results into a long-view story. Each event gets its own chart. 25-yard swims are solid; 50-yard swims are halved and dashed so the trend remains comparable across the distance change.

The dashboard opens in **Speed** view, using yards per second so distances compare naturally. Use **Raw times** to see separate 25-yard, 50-yard, and dashed 50-yard-divided-by-two series. Individual medley events such as 100 IM remain a single raw-time series.

Charts shade alternating summers to make the seasonal gaps easy to scan. Hovering a point shows its recorded age and time-standard label when one exists.

All event charts for a selected kid share that kid’s full date range. Hovering any chart also draws a synchronized vertical guide across the other event charts.

Event lines stay connected across meets where that event was not swum; the line bridges only the missing date slot and does not invent a data point.

## Run it

```bash
npm install
npx playwright install chromium   # first time only
npm run scrape                     # refresh public/data/swim-times.json
npm run dev
```

Then open the local URL printed by Vite. The site is static after the JSON file is generated, so `npm run build` produces a deployable `dist/` directory.

## Checks

```bash
npm test
npm run build
```

The scraper lives in [`scripts/scrape.ts`](scripts/scrape.ts). It uses Playwright to load each Acorn Swim Database page, walks the site’s event sections, skips non-times such as DQs, normalizes dates and converted times, retains bronze/silver/gold time standards, and writes a readable checked-in JSON file. Standard-bearing results appear as colored stars in the charts. To add another swimmer, add a source entry to `SOURCES` and re-run `npm run scrape`.
