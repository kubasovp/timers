export type Instant = string;

export function toInstant(date: Date): Instant {
  return date.toISOString();
}

export function parseInstant(instant: Instant): number {
  const value = Date.parse(instant);

  if (Number.isNaN(value)) {
    throw new Error(`Invalid instant: ${instant}`);
  }

  return value;
}

export function addSeconds(instant: Instant, seconds: number): Instant {
  return toInstant(new Date(parseInstant(instant) + seconds * 1000));
}

export function secondsUntil(target: Instant, now: Instant): number {
  return Math.max(0, Math.ceil((parseInstant(target) - parseInstant(now)) / 1000));
}

export function isDue(target: Instant, now: Instant): boolean {
  return parseInstant(target) <= parseInstant(now);
}

export function compareInstants(a: Instant, b: Instant): number {
  return parseInstant(a) - parseInstant(b);
}
