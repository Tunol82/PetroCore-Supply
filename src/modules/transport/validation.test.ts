import { describe, expect, it } from "vitest";
import {
  assignmentSchema,
  compartmentSchema,
  deliverySchema,
  discrepancySchema,
  driverSchema,
  evidenceSchema,
  investigationSchema,
  loadingAllocationSchema,
  loadingRecordSchema,
  reconciliationItemSchema,
  reconciliationSchema,
  releaseAssignmentSchema,
  transporterSchema,
  tripSchema,
  truckSchema,
} from "./validation";

const transporterId = "11111111-1111-1111-1111-111111111111";
const truckId = "22222222-2222-2222-2222-222222222222";
const driverId = "33333333-3333-3333-3333-333333333333";
const tripId = "44444444-4444-4444-4444-444444444444";
const productId = "55555555-5555-5555-5555-555555555555";

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

describe("loadingRecordSchema", () => {
  const base = {
    tripId,
    compartmentId: truckId,
    productId,
    loadedQuantity: "15000",
  };

  it("accepts a loading record", () => {
    expect(loadingRecordSchema.parse(base).loadedQuantity).toBe(15000);
  });

  it("rejects a zero loaded quantity", () => {
    expect(loadingRecordSchema.safeParse({ ...base, loadedQuantity: "0" }).success).toBe(false);
  });

  it("rejects an invalid loading date", () => {
    expect(loadingRecordSchema.safeParse({ ...base, loadingDate: "15/11/2026" }).success).toBe(false);
  });
});

describe("loadingAllocationSchema", () => {
  const base = {
    loadingRecordId: tripId,
    procurementBatchId: truckId,
    productId,
    allocatedQuantity: "10000",
  };

  it("accepts an allocation without an order line", () => {
    expect(loadingAllocationSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid order line", () => {
    expect(
      loadingAllocationSchema.safeParse({ ...base, salesOrderItemId: driverId }).success,
    ).toBe(true);
  });

  it("rejects an invalid order line", () => {
    expect(
      loadingAllocationSchema.safeParse({ ...base, salesOrderItemId: "abc" }).success,
    ).toBe(false);
  });

  it("rejects a zero allocated quantity", () => {
    expect(
      loadingAllocationSchema.safeParse({ ...base, allocatedQuantity: "0" }).success,
    ).toBe(false);
  });
});


describe("deliverySchema", () => {
  const base = {
    tripId,
    salesOrderItemId: productId,
    customerLocationId: transporterId,
    productId,
    deliveredQuantity: "1000",
    deliveryStatus: "complete" as const,
  };

  it("accepts a complete delivery", () => {
    expect(deliverySchema.parse(base).deliveredQuantity).toBe(1000);
  });

  it("accepts a confirmed quantity up to the delivered quantity", () => {
    expect(
      deliverySchema.safeParse({ ...base, customerConfirmedQuantity: "1000" }).success,
    ).toBe(true);
  });

  it("rejects a confirmed quantity above the delivered quantity", () => {
    expect(
      deliverySchema.safeParse({ ...base, customerConfirmedQuantity: "1001" }).success,
    ).toBe(false);
  });

  it("rejects a zero delivered quantity", () => {
    expect(deliverySchema.safeParse({ ...base, deliveredQuantity: "0" }).success).toBe(false);
  });
});

describe("evidenceSchema", () => {
  const base = {
    deliveryRecordId: tripId,
    evidenceType: "photo" as const,
    filePath: "deliveries/2026/waybill.jpg",
  };

  it("accepts evidence metadata", () => {
    expect(evidenceSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty storage reference", () => {
    expect(evidenceSchema.safeParse({ ...base, filePath: "" }).success).toBe(false);
  });

  it("rejects an unknown evidence type", () => {
    expect(evidenceSchema.safeParse({ ...base, evidenceType: "video" }).success).toBe(false);
  });
});


describe("reconciliationSchema", () => {
  const base = {
    tripId,
    reconciliationNumber: "REC-1",
    status: "pending" as const,
  };

  it("accepts a pending reconciliation", () => {
    expect(reconciliationSchema.parse(base).reconciliationNumber).toBe("REC-1");
  });

  it("rejects an unknown status", () => {
    expect(reconciliationSchema.safeParse({ ...base, status: "done" }).success).toBe(false);
  });
});

describe("reconciliationItemSchema", () => {
  const base = {
    reconciliationId: tripId,
    productId,
    loadedQuantity: "1000",
    deliveredQuantity: "980",
    reconciliationStatus: "flagged" as const,
  };

  it("accepts a reconciled line", () => {
    expect(reconciliationItemSchema.parse(base).deliveredQuantity).toBe(980);
  });

  it("rejects a negative loaded quantity", () => {
    expect(reconciliationItemSchema.safeParse({ ...base, loadedQuantity: "-1" }).success).toBe(false);
  });
});

describe("discrepancySchema", () => {
  const base = {
    reconciliationItemId: tripId,
    discrepancyType: "transport" as const,
    expectedQuantity: "1000",
    actualQuantity: "980",
    status: "open" as const,
  };

  it("accepts an open discrepancy", () => {
    expect(discrepancySchema.safeParse(base).success).toBe(true);
  });

  it("rejects a negative expected quantity", () => {
    expect(discrepancySchema.safeParse({ ...base, expectedQuantity: "-1" }).success).toBe(false);
  });
});

describe("investigationSchema", () => {
  const base = {
    discrepancyId: tripId,
    responsiblePartyType: "transporter" as const,
    responsibilityStatus: "undetermined" as const,
  };

  it("accepts an investigation", () => {
    expect(investigationSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an unknown party type", () => {
    expect(investigationSchema.safeParse({ ...base, responsiblePartyType: "driver" }).success).toBe(false);
  });
});


describe("releaseAssignmentSchema", () => {
  it("accepts an assignment identifier", () => {
    expect(releaseAssignmentSchema.safeParse({ assignmentId: tripId }).success).toBe(true);
  });

  it("rejects a missing assignment identifier", () => {
    expect(releaseAssignmentSchema.safeParse({ assignmentId: "" }).success).toBe(false);
  });
});

