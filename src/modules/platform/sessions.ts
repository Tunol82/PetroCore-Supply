import "server-only";

import { cookies } from "next/headers";
import type { createPlatformServiceClient } from "./service-client";
import type { PlatformAdmin } from "./authorization";

export const PLATFORM_SESSION_COOKIE = "pc_platform_session";
export const PLATFORM_SESSION_MINUTES = 30;

export type PlatformSession = {
  id: string;
  platformAdminId: string;
  organisationId: string;
  expiresAt: string;
  reason: string | null;
};

type ServiceClient = ReturnType<typeof createPlatformServiceClient>;

export function sessionExpiry(): Date {
  return new Date(Date.now() + PLATFORM_SESSION_MINUTES * 60 * 1000);
}

export async function setPlatformSessionCookie(id: string, expiresAt: Date) {
  const store = await cookies();

  store.set(PLATFORM_SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/platform",
    expires: expiresAt,
  });
}

export async function clearPlatformSessionCookie() {
  const store = await cookies();
  store.delete(PLATFORM_SESSION_COOKIE);
}

async function audit(
  service: ServiceClient,
  platformAdminId: string | null,
  organisationId: string | null,
  action: string,
  metadata: Record<string, unknown>,
) {
  await service.from("platform_audit_logs").insert({
    platform_admin_id: platformAdminId,
    organisation_id: organisationId,
    action,
    metadata,
  });
}

export async function createPlatformSession(
  service: ServiceClient,
  admin: PlatformAdmin,
  organisationId: string,
  reason: string,
): Promise<{ session: PlatformSession | null; error: string | null }> {
  const expiresAt = sessionExpiry();

  const { data, error } = await service
    .from("platform_tenant_sessions")
    .insert({
      platform_admin_id: admin.id,
      organisation_id: organisationId,
      expires_at: expiresAt.toISOString(),
      reason,
    })
    .select("id, platform_admin_id, organisation_id, expires_at, reason")
    .single();

  if (error || !data) {
    return { session: null, error: "The support session could not be created." };
  }

  await audit(service, admin.id, organisationId, "platform.tenant_entered", {
    reason,
    expires_at: data.expires_at,
  });

  return {
    session: {
      id: data.id,
      platformAdminId: data.platform_admin_id,
      organisationId: data.organisation_id,
      expiresAt: data.expires_at,
      reason: data.reason,
    },
    error: null,
  };
}

export async function getPlatformSession(
  service: ServiceClient,
  admin: PlatformAdmin,
): Promise<PlatformSession | null> {
  const store = await cookies();
  const sessionId = store.get(PLATFORM_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const { data } = await service
    .from("platform_tenant_sessions")
    .select("id, platform_admin_id, organisation_id, expires_at, ended_at, reason")
    .eq("id", sessionId)
    .maybeSingle();

  if (!data || data.platform_admin_id !== admin.id || data.ended_at) {
    return null;
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await service
      .from("platform_tenant_sessions")
      .update({ ended_at: new Date().toISOString(), ended_reason: "expired" })
      .eq("id", data.id)
      .is("ended_at", null);

    await audit(service, admin.id, data.organisation_id, "platform.session_expired", {
      session_id: data.id,
    });

    return null;
  }

  return {
    id: data.id,
    platformAdminId: data.platform_admin_id,
    organisationId: data.organisation_id,
    expiresAt: data.expires_at,
    reason: data.reason,
  };
}

export async function endPlatformSession(
  service: ServiceClient,
  admin: PlatformAdmin,
  session: PlatformSession,
  reason: "exit" | "revoked" = "exit",
) {
  await service
    .from("platform_tenant_sessions")
    .update({ ended_at: new Date().toISOString(), ended_reason: reason })
    .eq("id", session.id)
    .eq("platform_admin_id", admin.id)
    .is("ended_at", null);

  await audit(service, admin.id, session.organisationId, "platform.tenant_exited", {
    session_id: session.id,
    reason,
  });
}

export async function auditDeniedSwitch(
  service: ServiceClient,
  platformAdminId: string | null,
  organisationId: string | null,
  metadata: Record<string, unknown>,
) {
  await audit(service, platformAdminId, organisationId, "platform.switch_denied", metadata);
}
