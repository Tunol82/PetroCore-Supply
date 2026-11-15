import { describe, expect, it } from "vitest";
import { enterTenantSchema } from "./validation";

const organisationId = "11111111-1111-1111-1111-111111111111";

describe("enterTenantSchema", () => {
  it("accepts a tenant and a reason", () => {
    expect(enterTenantSchema.parse({ organisationId, reason: "Support ticket 42" })).toEqual({
      organisationId,
      reason: "Support ticket 42",
    });
  });

  it("trims the reason", () => {
    expect(enterTenantSchema.parse({ organisationId, reason: "  support call  " }).reason).toBe(
      "support call",
    );
  });

  it("rejects a missing tenant", () => {
    expect(enterTenantSchema.safeParse({ organisationId: "", reason: "support call" }).success).toBe(
      false,
    );
  });

  it("rejects a reason that is too short", () => {
    expect(enterTenantSchema.safeParse({ organisationId, reason: "hi" }).success).toBe(false);
  });

  it("rejects a reason that is too long", () => {
    expect(
      enterTenantSchema.safeParse({ organisationId, reason: "x".repeat(501) }).success,
    ).toBe(false);
  });
});
