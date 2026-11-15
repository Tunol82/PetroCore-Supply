import { z } from "zod";

export const ACCESS_LEVELS = ["view", "operate", "approve", "manage"] as const;

/**
 * PostgreSQL accepts any 128-bit UUID, including values that do not carry a
 * modern version/variant marker. Zod's strict `uuid()` rejects those, so the
 * shape is validated here and the database remains the authority for existence.
 */
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuid(message: string) {
  return z.string().regex(UUID_PATTERN, message);
}

export const assignRoleSchema = z.object({
  userId: uuid("Select a member."),
  roleId: uuid("Select a role."),
});

export const grantAccessSchema = z.object({
  userId: uuid("Select a member."),
  locationId: uuid("Select a location."),
  accessLevel: z.enum(ACCESS_LEVELS),
});

export const idSchema = z.object({
  id: uuid("Invalid record."),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type GrantAccessInput = z.infer<typeof grantAccessSchema>;
