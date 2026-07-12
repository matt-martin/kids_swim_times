import { describe, expect, it } from 'vitest';
import { alignSeriesToTimeline, chartAxis, chartLineOptions, chartModeLabel, chartSeries, DEFAULT_CHART_MODE, eventMetricItems, eventMetrics, nearestTimelineIndex, nextHoverState, seasonBands, timelineLabels, tooltipDetails } from './chartData';
import { speedInMilesPerHour, standardColor, type StandardLevel, type Swim } from './swim';

const swims: Swim[] = [
  { date: '2024-06-01', seconds: 30, distance: 25, sourceTime: '30.00Y', meet: 'A', age: 8, type: 'F' },
  { date: '2025-06-01', seconds: 50, distance: 50, sourceTime: '50.00Y', meet: 'B', age: 9, type: 'F' },
];

describe('chart series', () => {
  it('only shows comparable time when both 25 and 50 distances exist', () => {
    const only25 = eventMetrics([swims[0]]);
    const only50 = eventMetrics([swims[1]]);
    const mixed = eventMetrics(swims);
    const im = eventMetrics([{ date: '2026-06-28', seconds: 89.1, distance: 100, sourceTime: '1:29.10Y', meet: 'B', age: 11, type: 'F' }]);
    expect(eventMetricItems(only25, 'raw')).toEqual([['Best 25', 30]]);
    expect(eventMetricItems(only50, 'raw')).toEqual([['Best 50', 50]]);
    expect(eventMetricItems(mixed, 'raw')).toEqual([['Best 25', 30], ['Best 50', 50], ['Best comparable', 25]]);
    expect(eventMetricItems(mixed, 'speed')).toEqual([['Best mph', speedInMilesPerHour(50, 50)]]);
    expect(eventMetricItems(im, 'raw')).toEqual([['Best 100', 89.1]]);
  });

  it('freezes the shared guide on click until explicitly unfrozen', () => {
    const initial = { index: null, locked: false };
    const hovered = nextHoverState(initial, 'move', 2);
    const locked = nextHoverState(hovered, 'click', 2);
    expect(locked).toEqual({ index: 2, locked: true });
    expect(nextHoverState(locked, 'move', 4)).toEqual(locked);
    expect(nextHoverState(locked, 'unfreeze', null)).toEqual(initial);
  });

  it('defaults to Times and labels the mode toggle plainly', () => {
    expect(DEFAULT_CHART_MODE).toBe('raw');
    expect(chartModeLabel('raw')).toBe('Times');
    expect(chartModeLabel('speed')).toBe('Speed');
  });

  it('calculates best speed and best raw/comparable times per event', () => {
    expect(eventMetrics(swims)).toEqual({ bestSpeed: speedInMilesPerHour(50, 50), best25: 30, best50: 50, best100: null, bestComparable: 25 });
    expect(eventMetrics([{ date: '2026-06-28', seconds: 89.1, distance: 100, sourceTime: '1:29.10Y', meet: 'B', age: 11, type: 'F' }])).toEqual({ bestSpeed: speedInMilesPerHour(100, 89.1), best25: null, best50: null, best100: 89.1, bestComparable: 89.1 });
  });

  it('connects a series across dates where its event has no result', () => {
    expect(chartLineOptions()).toEqual({ spanGaps: true });
  });

  it('builds one shared chronological timeline for a swimmer', () => {
    expect(timelineLabels([
      swims[1],
      { ...swims[0], date: '2023-06-01' },
      swims[0],
    ])).toEqual(['2023-06-01', '2024-06-01', '2025-06-01']);
    expect(alignSeriesToTimeline(chartSeries(swims, 'speed'), swims.map((swim) => swim.date), ['2023-06-01', '2024-06-01', '2025-06-01'])[0].values).toEqual([null, speedInMilesPerHour(25, 30), speedInMilesPerHour(50, 50)]);
  });

  it('clamps a hovered chart position to the shared timeline', () => {
    expect(nearestTimelineIndex(2.4, 4)).toBe(2);
    expect(nearestTimelineIndex(-1, 4)).toBe(0);
    expect(nearestTimelineIndex(8, 4)).toBe(3);
    expect(nearestTimelineIndex(2, 0)).toBeNull();
  });

  it('groups contiguous result dates into alternating summer bands', () => {
    expect(seasonBands(['2024-06-01', '2024-07-01', '2025-06-01', '2026-06-01'])).toEqual([
      { year: '2024', start: 0, end: 1, alternate: false },
      { year: '2025', start: 2, end: 2, alternate: true },
      { year: '2026', start: 3, end: 3, alternate: false },
    ]);
  });

  it('includes age and an attached standard in point details', () => {
    expect(tooltipDetails({ date: '2025-06-01', seconds: 30, distance: 25, sourceTime: '30.00Y', meet: 'A', age: 9, type: 'F' })).toBe('Age 9');
    expect(tooltipDetails({ date: '2025-06-01', seconds: 30, distance: 25, sourceTime: '30.00Y', meet: 'A', age: 9, type: 'F', standard: { level: 'bronze', label: '9-10 Bronze' } })).toBe('Age 9 · 9-10 Bronze');
  });

  it('maps time standards to their visual star colors', () => {
    expect((['bronze', 'silver', 'gold'] as StandardLevel[]).map(standardColor)).toEqual(['#b8794a', '#93a4ad', '#d8a72b']);
  });

  it('uses an ascending raw-time axis with zero at the x-axis', () => {
    expect(chartAxis('raw')).toEqual({ reverse: false, beginAtZero: true });
  });

  it('turns mixed-distance swims into one comparable miles-per-hour series', () => {
    expect(chartSeries(swims, 'speed')).toEqual([{
      id: 'speed',
      label: 'miles per hour',
      values: [speedInMilesPerHour(25, 30), speedInMilesPerHour(50, 50)],
      color: 'coral',
      dashed: false,
    }]);
  });

  it('keeps raw 25, raw 50, and halved-50 series distinct', () => {
    expect(chartSeries(swims, 'raw')).toEqual([
      { id: '25', label: '25 yd', values: [30, null], color: 'coral', dashed: false },
      { id: '50', label: '50 yd', values: [null, 50], color: 'blue', dashed: false },
      { id: '50-per-25', label: '50 yd ÷ 2', values: [null, 25], color: 'coral', dashed: true },
    ]);
  });

  it('leaves a 100-yard individual medley as one raw-time series', () => {
    const im: Swim[] = [{ date: '2026-06-28', seconds: 89.1, distance: 100, sourceTime: '1:29.10Y', meet: 'B', age: 11, type: 'F' }];
    expect(chartSeries(im, 'raw')).toEqual([
      { id: '100', label: '100 yd', values: [89.1], color: 'coral', dashed: false },
    ]);
  });
});
