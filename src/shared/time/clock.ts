import type { Instant } from "./instant";

export interface Clock {
  now(): Instant;
}
