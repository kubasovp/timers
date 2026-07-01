import type { Clock } from "@/shared/time/clock";
import { toInstant, type Instant } from "@/shared/time/instant";

export class SystemClock implements Clock {
  now(): Instant {
    return toInstant(new Date());
  }
}
