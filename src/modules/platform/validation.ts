import { z } from "zod";

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const enterTenantSchema = z.object({
  organisationId: z.string().regex(UUID_PATTERN, "Select a tenant."),
  reason: z
    .string()
    .trim()
    .min(5, "Give a short reason for entering this tenant.")
    .max(500, "Keep the reason under 500 characters."),
});

export type EnterTenantInput = z.infer<typeof enterTenantSchema>;
