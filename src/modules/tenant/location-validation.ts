import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const LOCATION_TYPES = ["storage", "transit", "depot", "station", "office", "other"] as const;
export const LOCATION_STATUSES = ["active", "inactive"] as const;

export const locationSchema = z.object({
  locationCode: z.string().trim().min(2, "Enter a location code.").max(40),
  locationName: z.string().trim().min(2, "Enter the location name.").max(150),
  locationType: z.enum(LOCATION_TYPES),
  address: optionalText(500),
  contactPerson: optionalText(150),
  phone: optionalText(30),
  isStorageLocation: z.boolean(),
});

export const locationUpdateSchema = locationSchema.extend({
  id: uuid("Select a location."),
});

export const locationStatusSchema = z.object({
  id: uuid("Select a location."),
  status: z.enum(LOCATION_STATUSES),
});

export type LocationInput = z.infer<typeof locationSchema>;
