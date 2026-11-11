import { describe, expect, it } from "vitest";

describe("application foundation", () => {
  it("runs the unit test harness", () => {
    expect("Deuces Supply").toContain("Supply");
  });
});
