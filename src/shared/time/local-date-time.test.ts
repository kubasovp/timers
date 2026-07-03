import { describe, expect, it } from "vitest";
import {
  localDateTimeInputToInstant,
  toLocalDateTimeInputValue,
  toRelativeLocalDateTimeInputValue
} from "./local-date-time";

describe("local date time helpers", () => {
  it("formats values for datetime-local inputs in local time", () => {
    const date = new Date(2026, 6, 3, 15, 58);

    expect(toLocalDateTimeInputValue(date)).toBe("2026-07-03T15:58");
  });

  it("parses datetime-local input values as local instants", () => {
    const local = new Date(2026, 6, 3, 15, 58);

    expect(localDateTimeInputToInstant("2026-07-03T15:58")).toBe(local.toISOString());
  });

  it("rejects invalid datetime-local input values", () => {
    expect(localDateTimeInputToInstant("not-a-date")).toBeNull();
  });

  it("rounds relative quick times up to the next minute", () => {
    const now = new Date(2026, 6, 3, 15, 53, 30);

    expect(toRelativeLocalDateTimeInputValue(now, 5 * 60)).toBe("2026-07-03T15:59");
  });
});
