import "server-only";

import { createClient } from "@/shared/lib/supabase/server";
import { createPlatformServiceClient } from "./service-client";

export type PlatformAdmin = {
  id: string;
  authUserId: string;
  mfaRequired: boolean;
};

type PlatformContextResult =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      service: ReturnType<typeof createPlatformServiceClient>;
      userId: string;
      email: string;
      admin: PlatformAdmin;
      isMfaVerified: boolean;
      canEnterTenant: boolean;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "not_platform_admin";
      userId?: string;
    };

/**
 * Resolves the platform administrator for the current session.
 *
 * Platform identity is read with the service client because tenant roles are
 * denied access to `platform_admins` entirely. MFA is evaluated from the
 * authenticated Supabase session and is enforced unless the admin row opts out.
 */
export async function getPlatformContext(): Promise<PlatformContextResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const service = createPlatformServiceClient();
  const { data: row } = await service
    .from("platform_admins")
    .select("id, auth_user_id, status, mfa_required")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!row || row.status !== "active") {
    return { ok: false, reason: "not_platform_admin", userId: data.user.id };
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const isMfaVerified = assurance?.currentLevel === "aal2";

  const admin: PlatformAdmin = {
    id: row.id,
    authUserId: row.auth_user_id,
    mfaRequired: row.mfa_required,
  };

  return {
    ok: true,
    supabase,
    service,
    userId: data.user.id,
    email: data.user.email ?? "",
    admin,
    isMfaVerified,
    canEnterTenant: !admin.mfaRequired || isMfaVerified,
  };
}
