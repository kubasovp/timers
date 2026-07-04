import type { FocusProfile } from "../domain/focus-types";
import type { Instant } from "@/shared/time/instant";

export function createDefaultFocusProfiles(now: Instant = "2026-07-01T00:00:00.000Z"): FocusProfile[] {
  return [
    {
      id: "focus-profile-default",
      name: "Focus",
      focusDurationSec: 25 * 60,
      shortBreakSec: 5 * 60,
      longBreakSec: 15 * 60,
      cyclesBeforeLongBreak: 4,
      createdAtUtc: now,
      updatedAtUtc: now
    }
  ];
}
