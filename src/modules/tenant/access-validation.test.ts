import { describe, expect, it } from "vitest";
import { ACCESS_LEVELS, assignRoleSchema, grantAccessSchema, idSchema } from "./access-validation";

const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const roleId = "a2000000-0000-0000-0000-000000000001";
const locationId = "a1000000-0000-0000-0000-000000000001";

describe("access validation", () => {
  it("accepts a valid role assignment", () => {
    expect(assignRoleSchema.parse({ userId, roleId })).toEqual({ userId, roleId });
  });

  it("rejects a non-uuid member id", () => {
    expect(assignRoleSchema.safeParse({ userId: "abc", roleId }).success).toBe(false);
  });

  it("accepts each supported access level", () => {
    for (const accessLevel of ACCESS_LEVELS) {
      expect(grantAccessSchema.safeParse({ userId, locationId, accessLevel }).success).toBe(true);
    }
  });

  it("rejects an unsupported access level", () => {
    expect(grantAccessSchema.safeParse({ userId, locationId, accessLevel: "admin" }).success).toBe(false);
  });

  it("rejects an invalid id for revocation", () => {
    expect(idSchema.safeParse({ id: "" }).success).toBe(false);
  });
});
