import { describe, expect, it } from "vitest";
import { mapCurrentTenant, type CurrentTenantRow } from "./current-tenant";

const row: CurrentTenantRow = {
  id: "profile-1",
  full_name: "Alice",
  email: "alice@example.com",
  organisation_id: "org-1",
  organisations: {
    id: "org-1",
    display_name: "Alpha",
    organisation_code: "ORG-A",
  },
};

describe("mapCurrentTenant", () => {
  it("returns null when there is no profile row", () => {
    expect(mapCurrentTenant(null)).toBeNull();
  });

  it("maps a single organisation relation", () => {
    expect(mapCurrentTenant(row)).toEqual({
      profileId: "profile-1",
      fullName: "Alice",
      email: "alice@example.com",
      organisationId: "org-1",
      organisationName: "Alpha",
      organisationCode: "ORG-A",
    });
  });

  it("maps an array-shaped organisation relation", () => {
    const mapped = mapCurrentTenant({ ...row, organisations: [row.organisations as never] });
    expect(mapped?.organisationCode).toBe("ORG-A");
  });

  it("returns null when the organisation cannot be resolved", () => {
    expect(mapCurrentTenant({ ...row, organisations: null })).toBeNull();
  });

  it("falls back when optional profile fields are null", () => {
    const mapped = mapCurrentTenant({ ...row, full_name: null, email: null });
    expect(mapped?.fullName).toBe("Team member");
    expect(mapped?.email).toBe("");
  });
});
