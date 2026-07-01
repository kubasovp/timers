import type { Clock } from "@/shared/time/clock";
import { parseInstant, toInstant, type Instant } from "@/shared/time/instant";

export class FakeClock implements Clock {
  constructor(private current: Instant = toInstant(new Date(0))) {}

  now(): Instant {
    return this.current;
  }

  set(instant: Instant): void {
    this.current = instant;
  }

  advanceByMs(milliseconds: number): Instant {
    this.current = toInstant(new Date(parseInstant(this.current) + milliseconds));
    return this.current;
  }

  advanceBySeconds(seconds: number): Instant {
    return this.advanceByMs(seconds * 1000);
  }
}
