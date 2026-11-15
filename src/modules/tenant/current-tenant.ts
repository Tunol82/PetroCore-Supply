import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentTenant = {
  profileId: string;
  fullName: string;
  email: string;
  organisationId: string;
  organisationName: string;
  organisationCode: string;
};

type OrganisationRelation =
  | { id: string; display_name: string; organisation_code: string }
  | { id: string; display_name: string; organisation_code: string }[]
  | null;

export type CurrentTenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  organisation_id: string;
  organisations: OrganisationRelation;
};

/**
 * Maps the joined profile/organisation row to the tenant context.
 *
 * The relation may arrive as an object or a single-element array depending on
 * how PostgREST infers the foreign key, so both are handled. A profile without
 * a resolvable organisation yields null and the caller shows the
 * access-pending state.
 */
export function mapCurrentTenant(row: CurrentTenantRow | null): CurrentTenant | null {
  if (!row) {
    return null;
  }

  const organisation = Array.isArray(row.organisations) ? row.organisations[0] : row.organisations;

  if (!organisation) {
    return null;
  }

  return {
    profileId: row.id,
    fullName: row.full_name ?? "Team member",
    email: row.email ?? "",
    organisationId: row.organisation_id,
    organisationName: organisation.display_name,
    organisationCode: organisation.organisation_code,
  };
}

export type TenantResult = {
  tenant: CurrentTenant | null;
  error: string | null;
};

/**
 * Resolves the tenant for the authenticated user. Ownership and access are
 * enforced by RLS; this query cannot see another tenant's membership.
 */
export async function getCurrentTenant(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<TenantResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, organisation_id, organisations ( id, display_name, organisation_code )")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    return { tenant: null, error: error.message };
  }

  return { tenant: mapCurrentTenant(data as CurrentTenantRow | null), error: null };
}
