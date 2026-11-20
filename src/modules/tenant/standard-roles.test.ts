import { describe, expect, it } from "vitest";
import { PERMISSION_GROUPS, PERMISSION_LABELS, STANDARD_ROLES } from "./standard-roles";

describe("standard roles", () => {
  it("groups every permission exactly once", () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.keys);

    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(Object.keys(PERMISSION_LABELS)));
  });
  it("defines Director, Operations staff and Fleet manager once", () => {
    expect(STANDARD_ROLES.map((role) => role.name)).toEqual([
      "Director",
      "Operations staff",
      "Fleet manager",
    ]);
  });

  it("only uses known permission keys", () => {
    const known = new Set(Object.keys(PERMISSION_LABELS));

    for (const role of STANDARD_ROLES) {
      for (const permission of role.permissions) {
        expect(known.has(permission)).toBe(true);
      }
      expect(new Set(role.permissions).size).toBe(role.permissions.length);
    }
  });

  it("keeps configuration away from the Director", () => {
    const director = STANDARD_ROLES.find((role) => role.name === "Director");

    expect(director?.permissions).not.toContain("users.manage");
    expect(director?.permissions).not.toContain("organisation.manage");
    expect(director?.permissions).not.toContain("locations.manage");
    expect(director?.permissions).toContain("audit.view");
    expect(director?.permissions).toContain("transport.manage");
    expect(director?.permissions).toHaveLength(10);
  });

  it("gives the Director every operational permission", () => {
    const director = STANDARD_ROLES.find((role) => role.name === "Director");

    for (const permission of [
      "procurement.view",
      "procurement.manage",
      "inventory.view",
      "inventory.manage",
      "sales.view",
      "sales.manage",
      "transport.view",
      "transport.manage",
      "locations.view_all",
      "audit.view",
    ]) {
      expect(director?.permissions).toContain(permission);
    }
  });

  it("keeps people and settings away from Operations and Fleet", () => {
    for (const name of ["Operations staff", "Fleet manager"]) {
      const role = STANDARD_ROLES.find((item) => item.name === name);

      expect(role?.permissions).not.toContain("users.manage");
      expect(role?.permissions).not.toContain("organisation.manage");
      expect(role?.permissions).not.toContain("audit.view");
    }
  });

  it("keeps sales management and procurement management away from Fleet", () => {
    const fleet = STANDARD_ROLES.find((role) => role.name === "Fleet manager");

    expect(fleet?.permissions).not.toContain("sales.manage");
    expect(fleet?.permissions).not.toContain("procurement.manage");
    expect(fleet?.permissions).toContain("transport.manage");
    expect(fleet?.permissions).toContain("transport.view");
  });

  it("lets Operations manage the four operating modules", () => {
    const operations = STANDARD_ROLES.find((role) => role.name === "Operations staff");

    for (const permission of [
      "procurement.manage",
      "inventory.manage",
      "sales.manage",
      "transport.manage",
    ]) {
      expect(operations?.permissions).toContain(permission);
    }
  });
});
