export const EVENT_KEYS = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'individual-medley'] as const;

export type EventKey = (typeof EVENT_KEYS)[number];
// Keep this open-ended because the database includes events such as 100 IM.
export type Distance = number;
export type StandardLevel = 'bronze' | 'silver' | 'gold';
export type TimeStandard = { level: StandardLevel; label: string };

export type Swim = {
  date: string;
  seconds: number;
  distance: Distance;
  sourceTime: string;
  meet: string;
  age: number;
  type: string;
  standard?: TimeStandard;
};

export type Swimmer = {
  id: string;
  name: string;
  sourceUrl: string;
  events: Partial<Record<EventKey, Swim[]>>;
};

export type SwimPoint = Swim & {
  comparableSeconds: number;
  isSplit: boolean;
};

const EVENT_LABELS: Record<EventKey, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke',
  butterfly: 'Butterfly',
  'individual-medley': 'Individual medley',
};

const EVENT_SHORT_LABELS: Record<EventKey, string> = {
  freestyle: 'FR',
  backstroke: 'BK',
  breaststroke: 'BR',
  butterfly: 'FLY',
  'individual-medley': 'IM',
};

export function eventShortLabel(event: EventKey): string {
  return EVENT_SHORT_LABELS[event];
}

const STANDARD_COLORS: Record<StandardLevel, string> = {
  bronze: '#b8794a',
  silver: '#93a4ad',
  gold: '#d8a72b',
};

export function standardColor(level: StandardLevel): string {
  return STANDARD_COLORS[level];
}

export function standardFromCell(className: string, title: string): TimeStandard | undefined {
  const level = className.toLowerCase().split(/\s+/).find((value): value is StandardLevel => value in STANDARD_COLORS);
  return level ? { level, label: title.trim() } : undefined;
}

export function eventLabel(event: EventKey): string {
  return EVENT_LABELS[event];
}

export function parseTimeToSeconds(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '');
  if (!normalized || /^(DQ|NS|NT)$/i.test(normalized)) return null;

  const parts = normalized.split(':');
  const seconds = parts.length === 1
    ? Number(parts[0])
    : Number(parts.at(-1)) + Number(parts.at(-2)) * 60;

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${remainder.toFixed(2).padStart(5, '0')}` : remainder.toFixed(2);
}

export function normalizePoints(swims: Swim[]): SwimPoint[] {
  return swims
    .map((swim) => ({
      ...swim,
      comparableSeconds: swim.distance === 50 ? swim.seconds / 2 : swim.seconds,
      isSplit: swim.distance === 50,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.seconds - b.seconds);
}

export function eventFromLabel(label: string): { event: EventKey; distance: Distance } | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d+)\s+(freestyle|backstroke|breaststroke|butterfly|individual medley)$/);
  if (!match) return null;
  return {
    distance: Number(match[1]) as Distance,
    event: match[2] === 'individual medley' ? 'individual-medley' : match[2] as EventKey,
  };
}
