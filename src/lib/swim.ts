export const EVENT_KEYS = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'individual-medley'] as const;

export type EventKey = (typeof EVENT_KEYS)[number];
export type Distance = 25 | 50;

export type Swim = {
  date: string;
  seconds: number;
  distance: Distance;
  sourceTime: string;
  meet: string;
  age: number;
  type: string;
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
  const match = normalized.match(/^(25|50)\s+(freestyle|backstroke|breaststroke|butterfly|individual medley)$/);
  if (!match) return null;
  return {
    distance: Number(match[1]) as Distance,
    event: match[2] === 'individual medley' ? 'individual-medley' : match[2] as EventKey,
  };
}
