import { describe, expect, it } from "vitest";
import { LOCATION_TYPES, locationSchema, locationStatusSchema, locationUpdateSchema } from "./location-validation";

const locationId = "11111111-1111-1111-1111-111111111111";

const base = {
  locationCode: "LOC-1",
  locationName: "Main Depot",
  locationType: "storage" as const,
  isStorageLocation: true,
};

describe("locationSchema", () => {
  it("accepts a minimal location", () => {
    expect(locationSchema.safeParse(base).success).toBe(true);
  });

  it("accepts every configured type", () => {
    for (const type of LOCATION_TYPES) {
      expect(locationSchema.safeParse({ ...base, locationType: type }).success).toBe(true);
    }
  });

  it("rejects a missing name or code", () => {
    expect(locationSchema.safeParse({ ...base, locationCode: "" }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, locationName: "" }).success).toBe(false);
  });

  it("trims the code and name", () => {
    expect(locationSchema.parse({ ...base, locationCode: " LOC-1 ", locationName: " Main Depot " })).toMatchObject({
      locationCode: "LOC-1",
      locationName: "Main Depot",
    });
  });
});

describe("location lifecycle", () => {
  it("requires the id on update", () => {
    expect(locationUpdateSchema.safeParse(base).success).toBe(false);
    expect(locationUpdateSchema.safeParse({ ...base, id: locationId }).success).toBe(true);
  });

  it("accepts active and inactive statuses and rejects others", () => {
    expect(locationStatusSchema.safeParse({ id: locationId, status: "active" }).success).toBe(true);
    expect(locationStatusSchema.safeParse({ id: locationId, status: "inactive" }).success).toBe(true);
    expect(locationStatusSchema.safeParse({ id: locationId, status: "closed" }).success).toBe(false);
  });
});
