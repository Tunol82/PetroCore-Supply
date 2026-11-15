import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalEmail = z.string().trim().email("Enter a valid email address.").optional().or(z.literal(""));
const optionalUuid = (message: string) =>
  z.string().optional().or(z.literal("")).refine((value) => !value || UUID_PATTERN.test(value), message);
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").optional(),
);

export const OWNERSHIP_TYPES = ["company", "third_party"] as const;
export const TRUCK_STATUSES = ["active", "inactive", "maintenance", "retired"] as const;
export const DRIVER_TYPES = ["employee", "third_party"] as const;
export const TRIP_STATUSES = [
  "planned",
  "assigned",
  "loading",
  "in_transit",
  "delivered",
  "closed",
  "cancelled",
] as const;
export const ASSIGNMENT_ROLES = ["primary", "additional"] as const;

export const transporterSchema = z.object({
  transporterCode: z.string().trim().min(2, "Enter a transporter code.").max(40),
  businessName: z.string().trim().min(2, "Enter the transporter name.").max(200),
  contactPerson: optionalText(150),
  phone: optionalText(30),
  email: optionalEmail,
  address: optionalText(500),
  paymentTerms: optionalText(40),
});

export const truckSchema = z
  .object({
    registrationNumber: z.string().trim().min(2, "Enter the registration number.").max(40),
    transporterId: optionalUuid("Select a transporter."),
    make: optionalText(100),
    model: optionalText(100),
    year: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce.number().int().min(1900).max(2100).optional(),
    ),
    capacity: z.coerce.number().positive("Capacity must be greater than zero."),
    ownershipType: z.enum(OWNERSHIP_TYPES),
    status: z.enum(TRUCK_STATUSES),
  })
  .refine(
    (value) => value.ownershipType !== "third_party" || Boolean(value.transporterId),
    { message: "A third-party truck must be linked to a transporter.", path: ["transporterId"] },
  );

export const compartmentSchema = z.object({
  truckId: uuid("Select a truck."),
  compartmentNumber: z.string().trim().min(1, "Enter the compartment number.").max(30),
  capacity: z.coerce.number().positive("Capacity must be greater than zero."),
  productCompatibility: optionalText(500),
});

export const driverSchema = z
  .object({
    transporterId: optionalUuid("Select a transporter."),
    driverCode: z.string().trim().min(2, "Enter a driver code.").max(40),
    fullName: z.string().trim().min(2, "Enter the driver name.").max(200),
    phone: optionalText(30),
    licenceNumber: z.string().trim().min(2, "Enter the licence number.").max(80),
    licenceExpiry: optionalDate,
    driverType: z.enum(DRIVER_TYPES),
  })
  .refine(
    (value) => value.driverType !== "third_party" || Boolean(value.transporterId),
    { message: "A third-party driver must be linked to a transporter.", path: ["transporterId"] },
  );

export const tripSchema = z
  .object({
    tripNumber: z.string().trim().min(2, "Enter the trip number.").max(50),
    originSupplierDepotId: optionalUuid("Select a supplier depot."),
    originLocationId: optionalUuid("Select an origin location."),
    destinationLocationId: optionalUuid("Select a destination location."),
    departureDate: optionalDate,
    expectedArrivalDate: optionalDate,
  })
  .refine(
    (value) =>
      !value.departureDate ||
      !value.expectedArrivalDate ||
      value.expectedArrivalDate >= value.departureDate,
    { message: "Expected arrival cannot precede departure.", path: ["expectedArrivalDate"] },
  );

export const assignmentSchema = z.object({
  tripId: uuid("Select a trip."),
  truckId: uuid("Select a truck."),
  driverId: uuid("Select a driver."),
  transporterId: optionalUuid("Select a transporter."),
  assignmentRole: z.enum(ASSIGNMENT_ROLES),
});

export const loadingRecordSchema = z.object({
  tripId: uuid("Select a trip."),
  compartmentId: uuid("Select a compartment."),
  productId: uuid("Select a product."),
  loadedQuantity: z.coerce.number().positive("Loaded quantity must be greater than zero."),
  loadingTicket: optionalText(100),
  sealNumber: optionalText(100),
  loadingDate: optionalDate,
});

export const loadingAllocationSchema = z.object({
  loadingRecordId: uuid("Select a loading record."),
  procurementBatchId: uuid("Select a procurement batch."),
  salesOrderItemId: optionalUuid("Select a valid order line."),
  productId: uuid("Select a product."),
  allocatedQuantity: z.coerce.number().positive("Allocated quantity must be greater than zero."),
});

export type TransporterInput = z.infer<typeof transporterSchema>;
export type TruckInput = z.infer<typeof truckSchema>;
export type CompartmentInput = z.infer<typeof compartmentSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
