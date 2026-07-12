import { describe, expect, it } from 'vitest';
import { alignSeriesToTimeline, chartAxis, chartSeries, nearestTimelineIndex, seasonBands, timelineLabels, tooltipDetails } from './chartData';
import { standardColor, type StandardLevel, type Swim } from './swim';

const swims: Swim[] = [
  { date: '2024-06-01', seconds: 30, distance: 25, sourceTime: '30.00Y', meet: 'A', age: 8, type: 'F' },
  { date: '2025-06-01', seconds: 50, distance: 50, sourceTime: '50.00Y', meet: 'B', age: 9, type: 'F' },
];

describe('chart series', () => {
  it('builds one shared chronological timeline for a swimmer', () => {
    expect(timelineLabels([
      swims[1],
      { ...swims[0], date: '2023-06-01' },
      swims[0],
    ])).toEqual(['2023-06-01', '2024-06-01', '2025-06-01']);
    expect(alignSeriesToTimeline(chartSeries(swims, 'speed'), swims.map((swim) => swim.date), ['2023-06-01', '2024-06-01', '2025-06-01'])[0].values).toEqual([null, 25 / 30, 1]);
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

  it('turns mixed-distance swims into one comparable yards-per-second series', () => {
    expect(chartSeries(swims, 'speed')).toEqual([{
      id: 'speed',
      label: 'yards / second',
      values: [25 / 30, 1],
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
