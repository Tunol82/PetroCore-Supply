import { describe, expect, it } from "vitest";
import { signInSchema } from "./validation";

describe("signInSchema", () => {
  it("trims a valid email address", () => {
    expect(
      signInSchema.parse({ email: "  user@example.com  ", password: "secret" }),
    ).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("rejects an invalid email address", () => {
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "secret" }).success,
    ).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "user@example.com", password: "" }).success,
    ).toBe(false);
  });
});
