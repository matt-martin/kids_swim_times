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

  it('stores the time standard attached to a result row', () => {
    const swimmer = parseSections(
      { id: 'test', name: 'Test', url: 'https://example.com' },
      [{
        label: '25 FREESTYLE',
        rows: [{
          cells: ['', '25.00', '25.00Y', 'MEET_1', '06/01/2025', '10', 'F', '1', ''],
          standard: { level: 'bronze', label: '9-10 Bronze' },
        }],
      }],
    );
    expect(swimmer.events.freestyle?.[0].standard).toEqual({ level: 'bronze', label: '9-10 Bronze' });
  });
});
