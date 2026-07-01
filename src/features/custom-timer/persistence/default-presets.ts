import { toInstant } from "@/shared/time/instant";
import type { CustomTimerPreset } from "../domain/custom-timer-types";

export function createDefaultTimerPresets(now = toInstant(new Date())): CustomTimerPreset[] {
  return [
    {
      id: "preset-5m",
      name: "5 min",
      durationTotalSec: 5 * 60,
      category: "Quick",
      createdAtUtc: now,
      updatedAtUtc: now
    },
    {
      id: "preset-10m",
      name: "10 min",
      durationTotalSec: 10 * 60,
      category: "Quick",
      createdAtUtc: now,
      updatedAtUtc: now
    },
    {
      id: "preset-25m",
      name: "25 min",
      durationTotalSec: 25 * 60,
      category: "Focus",
      createdAtUtc: now,
      updatedAtUtc: now
    }
  ];
}
