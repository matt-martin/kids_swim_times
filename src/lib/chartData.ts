import { normalizePoints, type Swim } from './swim';

export type ChartMode = 'speed' | 'raw';
export const DEFAULT_CHART_MODE: ChartMode = 'raw';
export type SeriesColor = 'coral' | 'blue';

export type ChartSeries = {
  id: string;
  label: string;
  values: (number | null)[];
  color: SeriesColor;
  dashed: boolean;
};

export type SeasonBand = { year: string; start: number; end: number; alternate: boolean };
export type HoverState = { index: number | null; locked: boolean };
export type HoverEvent = 'move' | 'leave' | 'click' | 'unfreeze';

export function chartModeLabel(mode: ChartMode): string {
  return mode === 'raw' ? 'Times' : 'Speed';
}

export function nextHoverState(state: HoverState, event: HoverEvent, index: number | null): HoverState {
  if (event === 'unfreeze') return { index: null, locked: false };
  if (event === 'click') return index === null ? state : { index, locked: true };
  if (state.locked) return state;
  return event === 'move' ? { index, locked: false } : { index: null, locked: false };
}

export function timelineLabels(swims: Swim[]): string[] {
  return [...new Set(swims.map((swim) => swim.date))].sort();
}

export function alignSeriesToTimeline(series: ChartSeries[], eventDates: string[], labels: string[]): ChartSeries[] {
  return series.map((item) => ({
    ...item,
    values: labels.map((label) => {
      const eventIndex = eventDates.indexOf(label);
      return eventIndex === -1 ? null : item.values[eventIndex];
    }),
  }));
}

export function nearestTimelineIndex(value: number, labelCount: number): number | null {
  if (!labelCount || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(labelCount - 1, Math.round(value)));
}

export function chartLineOptions() {
  return { spanGaps: true };
}

export type EventMetrics = {
  bestSpeed: number | null;
  best25: number | null;
  best50: number | null;
  best100: number | null;
  bestComparable: number | null;
};

export function eventMetrics(swims: Swim[]): EventMetrics {
  const points = normalizePoints(swims);
  const minimum = (values: number[]) => values.length ? Math.min(...values) : null;
  return {
    bestSpeed: points.length ? Math.max(...points.map((point) => point.distance / point.seconds)) : null,
    best25: minimum(points.filter((point) => point.distance === 25).map((point) => point.seconds)),
    best50: minimum(points.filter((point) => point.distance === 50).map((point) => point.seconds)),
    best100: minimum(points.filter((point) => point.distance === 100).map((point) => point.seconds)),
    bestComparable: minimum(points.map((point) => point.comparableSeconds)),
  };
}

export function eventMetricItems(metrics: EventMetrics, mode: ChartMode): Array<[string, number]> {
  if (mode === 'speed') {
    return [
      ...(metrics.bestSpeed === null ? [] : [['Best yd/sec', metrics.bestSpeed] as [string, number]]),
      ...(metrics.best100 === null ? [] : [['Best 100', metrics.best100] as [string, number]]),
    ];
  }

  const items: Array<[string, number]> = [];
  if (metrics.best25 !== null) items.push(['Best 25', metrics.best25]);
  if (metrics.best50 !== null) items.push(['Best 50', metrics.best50]);
  if (metrics.best100 !== null && metrics.best25 === null && metrics.best50 === null) items.push(['Best 100', metrics.best100]);
  if (metrics.best25 !== null && metrics.best50 !== null && metrics.bestComparable !== null) items.push(['Best comparable', metrics.bestComparable]);
  return items;
}

export function seasonBands(labels: string[]): SeasonBand[] {
  if (!labels.length) return [];
  const bands: SeasonBand[] = [];
  let start = 0;
  let year = labels[0].slice(0, 4);
  for (let index = 1; index <= labels.length; index += 1) {
    const nextYear = labels[index]?.slice(0, 4);
    if (index === labels.length || nextYear !== year) {
      bands.push({ year, start, end: index - 1, alternate: bands.length % 2 === 1 });
      start = index;
      year = nextYear;
    }
  }
  return bands;
}

export function tooltipDetails(point: Swim): string {
  return `Age ${point.age}${point.standard ? ` · ${point.standard.label}` : ''}`;
}

export function chartAxis(mode: ChartMode) {
  return { reverse: false, beginAtZero: mode === 'raw' };
}

export function chartSeries(swims: Swim[], mode: ChartMode): ChartSeries[] {
  const points = normalizePoints(swims);

  if (mode === 'speed') {
    return [{
      id: 'speed',
      label: 'yards / second',
      values: points.map((point) => point.distance / point.seconds),
      color: 'coral',
      dashed: false,
    }];
  }

  const series: ChartSeries[] = [];
  const primaryDistances = [...new Set(points.filter((point) => point.distance !== 50).map((point) => point.distance))].sort((a, b) => a - b);
  for (const distance of primaryDistances) {
    series.push({
      id: String(distance),
      label: `${distance} yd`,
      values: points.map((point) => point.distance === distance ? point.seconds : null),
      color: 'coral',
      dashed: false,
    });
  }

  if (points.some((point) => point.distance === 50)) {
    series.push({
      id: '50',
      label: '50 yd',
      values: points.map((point) => point.distance === 50 ? point.seconds : null),
      color: 'blue',
      dashed: false,
    });
    series.push({
      id: '50-per-25',
      label: '50 yd ÷ 2',
      values: points.map((point) => point.distance === 50 ? point.seconds / 2 : null),
      color: 'coral',
      dashed: true,
    });
  }

  return series;
}
