import { normalizePoints, type Swim } from './swim';

export type ChartMode = 'speed' | 'raw';
export type SeriesColor = 'coral' | 'blue';

export type ChartSeries = {
  id: string;
  label: string;
  values: (number | null)[];
  color: SeriesColor;
  dashed: boolean;
};

export type SeasonBand = { year: string; start: number; end: number; alternate: boolean };

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
