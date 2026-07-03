import type { Instant } from "./instant";

export function localDateTimeInputToInstant(value: string): Instant | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toRelativeLocalDateTimeInputValue(now: Date, seconds: number): string {
  return toLocalDateTimeInputValue(roundUpToNextMinute(new Date(now.getTime() + seconds * 1000)));
}

function roundUpToNextMinute(date: Date): Date {
  const rounded = new Date(date);

  if (rounded.getSeconds() === 0 && rounded.getMilliseconds() === 0) {
    return rounded;
  }

  rounded.setMinutes(rounded.getMinutes() + 1);
  rounded.setSeconds(0, 0);
  return rounded;
}
