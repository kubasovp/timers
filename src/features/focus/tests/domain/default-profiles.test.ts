import { describe, expect, it } from "vitest";
import { createDefaultFocusProfiles } from "../../persistence/default-profiles";

describe("default focus profiles", () => {
  it("uses generic focus naming", () => {
    expect(createDefaultFocusProfiles()[0]).toMatchObject({
      id: "focus-profile-default",
      name: "Focus"
    });
  });
});
