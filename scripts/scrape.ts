import { chromium, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { eventFromLabel, parseTimeToSeconds, type EventKey, type Swim, type Swimmer } from '../src/lib/swim';

export const SOURCES = [
  { id: 'oliver', name: 'Oliver', url: 'https://www.acornswim.com/Database/search/indsearch.php?swimmernames=MARTIN%2C+OLIVER+%28MEAD%29&year%5B%5D=2026&year%5B%5D=2025&year%5B%5D=2024&year%5B%5D=2023&year%5B%5D=2022&year%5B%5D=2021&year%5B%5D=2020&year%5B%5D=2019&year%5B%5D=2018&yearselect=more&league=OMPA' },
  { id: 'henry', name: 'Henry', url: 'https://www.acornswim.com/Database/search/indsearch.php?swimmernames=MARTIN%2C+HENRY+%28MEAD%29&year%5B%5D=2026&year%5B%5D=2025&year%5B%5D=2024&year%5B%5D=2023&year%5B%5D=2022&year%5B%5D=2021&year%5B%5D=2020&year%5B%5D=2019&year%5B%5D=2018&yearselect=more&league=ompa' },
  { id: 'emma', name: 'Emma', url: 'https://www.acornswim.com/Database/search/indsearch.php?swimmernames=MARTIN%2C+EMMA+%28MEAD%29&year%5B%5D=2026&year%5B%5D=2025&year%5B%5D=2024&year%5B%5D=2023&year%5B%5D=2022&year%5B%5D=2021&year%5B%5D=2020&year%5B%5D=2019&yearselect=more&league=ompa' },
  { id: 'maggie', name: 'Maggie', url: 'https://www.acornswim.com/Database/search/indsearch.php?swimmernames=MARTIN%2C+MAGGIE+%28MEAD%29&year%5B%5D=2026&year%5B%5D=2025&year%5B%5D=2024&year%5B%5D=2023&year%5B%5D=2022&year%5B%5D=2021&year%5B%5D=2020&year%5B%5D=2019&yearselect=more&league=ompa' },
] as const;

type RawSection = { label: string; rows: string[][] };

export function parseSections(source: { id: string; name: string; url: string }, sections: RawSection[]): Swimmer {
  const events: Partial<Record<EventKey, Swim[]>> = {};

  for (const section of sections) {
    const eventInfo = eventFromLabel(section.label);
    if (!eventInfo) continue;
    const swims = section.rows.flatMap((cells) => {
      const convertedTime = parseTimeToSeconds(cells[1] ?? '');
      const date = parseDate(cells[4] ?? '');
      const age = Number(cells[5]);
      if (convertedTime === null || !date || !Number.isFinite(age)) return [];
      return [{
        date,
        seconds: convertedTime,
        distance: eventInfo.distance,
        sourceTime: cells[2]?.trim() ?? '',
        meet: cells[3]?.trim() ?? '',
        age,
        type: cells[6]?.trim() ?? '',
      }];
    });
    if (swims.length) events[eventInfo.event] = [...(events[eventInfo.event] ?? []), ...swims];
  }

  return { id: source.id, name: source.name, sourceUrl: source.url, events };
}

function parseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

async function readSections(page: Page): Promise<RawSection[]> {
  return page.locator('#indresultstable').evaluate((table) => {
    const sections: RawSection[] = [];
    let current: RawSection | undefined;
    for (const row of Array.from(table.querySelectorAll('tr'))) {
      if (row.classList.contains('eventrow')) {
        current = { label: row.querySelector('th')?.textContent?.replace(/\s+/g, ' ').trim() ?? '', rows: [] };
        sections.push(current);
        continue;
      }
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      if (current && cells.length === 9 && /^\d{2}\/\d{2}\/\d{4}$/.test(cells[4])) current.rows.push(cells);
    }
    return sections;
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const swimmers: Swimmer[] = [];

  for (const source of SOURCES) {
    console.log(`Fetching ${source.name}...`);
    await page.goto(source.url, { waitUntil: 'domcontentloaded' });
    await page.locator('#indresultstable').waitFor();
    swimmers.push(parseSections(source, await readSections(page)));
  }

  await browser.close();
  const output = { fetchedAt: new Date().toISOString(), swimmers };
  const target = resolve('public/data/swim-times.json');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${target}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exitCode = 1; });
