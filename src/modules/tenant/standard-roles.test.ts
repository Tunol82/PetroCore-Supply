import { describe, expect, it } from "vitest";
import { PERMISSION_LABELS, STANDARD_ROLES } from "./standard-roles";

describe("standard roles", () => {
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

  it("gives the Director every permission", () => {
    const director = STANDARD_ROLES.find((role) => role.name === "Director");

    expect(director?.permissions).toHaveLength(Object.keys(PERMISSION_LABELS).length);
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
