import { describe, expect, it } from 'vitest';
import { eventFromLabel, formatTime, normalizePoints, parseTimeToSeconds } from './swim';

describe('swim time helpers', () => {
  it.each([
    ['34.25', 34.25],
    ['1:02.50', 62.5],
    ['DQ', null],
    ['NT', null],
  ])('parses %s', (value, expected) => {
    expect(parseTimeToSeconds(value)).toBe(expected);
  });

  it('formats minute and sub-minute times', () => {
    expect(formatTime(34.25)).toBe('34.25');
    expect(formatTime(62.5)).toBe('1:02.50');
  });

  it('maps the site labels to the five dashboard events', () => {
    expect(eventFromLabel(' 50 INDIVIDUAL MEDLEY ')).toEqual({ event: 'individual-medley', distance: 50 });
    expect(eventFromLabel('100 INDIVIDUAL MEDLEY')).toEqual({ event: 'individual-medley', distance: 100 });
  });

  it('halves 50-yard swims for the comparable dashed series', () => {
    const points = normalizePoints([
      { date: '2025-06-01', seconds: 48, distance: 50, sourceTime: '48.00Y', meet: 'A', age: 10, type: 'F' },
      { date: '2024-06-01', seconds: 30, distance: 25, sourceTime: '30.00Y', meet: 'B', age: 8, type: 'F' },
    ]);
    expect(points.map(({ comparableSeconds, isSplit }) => ({ comparableSeconds, isSplit }))).toEqual([
      { comparableSeconds: 30, isSplit: false },
      { comparableSeconds: 24, isSplit: true },
    ]);
  });
});
