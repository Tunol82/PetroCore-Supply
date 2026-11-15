import { describe, expect, it } from "vitest";
import {
  assignmentSchema,
  compartmentSchema,
  driverSchema,
  transporterSchema,
  tripSchema,
  truckSchema,
} from "./validation";

const transporterId = "11111111-1111-1111-1111-111111111111";
const truckId = "22222222-2222-2222-2222-222222222222";
const driverId = "33333333-3333-3333-3333-333333333333";
const tripId = "44444444-4444-4444-4444-444444444444";

describe("transporterSchema", () => {
  it("accepts a minimal transporter", () => {
    expect(transporterSchema.parse({ transporterCode: "TR-1", businessName: "Haulage Ltd" }).businessName).toBe(
      "Haulage Ltd",
    );
  });

  it("rejects a missing code", () => {
    expect(transporterSchema.safeParse({ transporterCode: "", businessName: "Haulage Ltd" }).success).toBe(false);
  });
});

describe("truckSchema", () => {
  const base = {
    registrationNumber: "LAG-123-XY",
    capacity: "45000",
    ownershipType: "company" as const,
    status: "active" as const,
  };

  it("accepts a company truck without a transporter", () => {
    expect(truckSchema.safeParse(base).success).toBe(true);
  });

  it("requires a transporter for third-party trucks", () => {
    expect(truckSchema.safeParse({ ...base, ownershipType: "third_party" }).success).toBe(false);
    expect(
      truckSchema.safeParse({ ...base, ownershipType: "third_party", transporterId }).success,
    ).toBe(true);
  });

  it("rejects a non-positive capacity", () => {
    expect(truckSchema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
  });
});

describe("compartmentSchema", () => {
  it("accepts a compartment", () => {
    expect(
      compartmentSchema.safeParse({ truckId, compartmentNumber: "1", capacity: "15000" }).success,
    ).toBe(true);
  });

  it("rejects a missing truck", () => {
    expect(
      compartmentSchema.safeParse({ truckId: "", compartmentNumber: "1", capacity: "15000" }).success,
    ).toBe(false);
  });
});

describe("driverSchema", () => {
  const base = {
    driverCode: "DRV-1",
    fullName: "Driver One",
    licenceNumber: "LIC-1",
    driverType: "employee" as const,
  };

  it("accepts an employee driver without a transporter", () => {
    expect(driverSchema.safeParse(base).success).toBe(true);
  });

  it("requires a transporter for third-party drivers", () => {
    expect(driverSchema.safeParse({ ...base, driverType: "third_party" }).success).toBe(false);
    expect(
      driverSchema.safeParse({ ...base, driverType: "third_party", transporterId }).success,
    ).toBe(true);
  });
});

describe("tripSchema", () => {
  const base = { tripNumber: "TRIP-1" };

  it("accepts a planned trip with no dates", () => {
    expect(tripSchema.safeParse(base).success).toBe(true);
  });

  it("rejects arrival before departure", () => {
    expect(
      tripSchema.safeParse({
        ...base,
        departureDate: "2026-11-15",
        expectedArrivalDate: "2026-11-14",
      }).success,
    ).toBe(false);
  });

  it("accepts arrival after departure", () => {
    expect(
      tripSchema.safeParse({
        ...base,
        departureDate: "2026-11-15",
        expectedArrivalDate: "2026-11-16",
      }).success,
    ).toBe(true);
  });
});

describe("assignmentSchema", () => {
  it("accepts a primary assignment", () => {
    expect(
      assignmentSchema.safeParse({
        tripId,
        truckId,
        driverId,
        assignmentRole: "primary",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown role", () => {
    expect(
      assignmentSchema.safeParse({
        tripId,
        truckId,
        driverId,
        assignmentRole: "backup",
      }).success,
    ).toBe(false);
  });
});
