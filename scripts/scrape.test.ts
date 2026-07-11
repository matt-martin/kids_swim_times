import { describe, expect, it } from 'vitest';
import { parseSections } from './scrape';

describe('results scraper normalization', () => {
  it('keeps valid swims, skips disqualifications, and records the source distance', () => {
    const swimmer = parseSections(
      { id: 'test', name: 'Test', url: 'https://example.com' },
      [{
        label: '50 FREESTYLE',
        rows: [
          ['', '1:02.50', '1:02.50Y', 'MEET_1', '06/01/2025', '10', 'F', '1', ''],
          ['', 'DQ', 'DQ', 'MEET_2', '06/02/2025', '10', 'F', '0', ''],
        ],
      }],
    );
    expect(swimmer.events.freestyle).toEqual([expect.objectContaining({ date: '2025-06-01', seconds: 62.5, distance: 50 })]);
  });
});
