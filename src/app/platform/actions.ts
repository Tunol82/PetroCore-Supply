"use server";

import { redirect } from "next/navigation";
import { getPlatformContext } from "@/modules/platform/authorization";
import { createPlatformServiceClient } from "@/modules/platform/service-client";
import {
  clearImpersonationCookies,
  readImpersonation,
  setImpersonationCookies,
  IMPERSONATION_MINUTES,
} from "@/modules/platform/impersonation";
import { enterTenantSchema } from "@/modules/platform/validation";
import {
  auditDeniedSwitch,
  clearPlatformSessionCookie,
  createPlatformSession,
  endPlatformSession,
  getPlatformSession,
  setPlatformSessionCookie,
} from "@/modules/platform/sessions";

export type PlatformActionState = {
  error: string | null;
};

export async function enterTenant(
  _previous: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const parsed = enterTenantSchema.safeParse({
    organisationId: formData.get("organisationId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the submitted values." };
  }

  const context = await getPlatformContext();

  if (!context.ok) {
    return { error: "Platform access is not available for this account." };
  }

  if (!context.canEnterTenant) {
    await auditDeniedSwitch(context.service, context.admin.id, parsed.data.organisationId, {
      reason: "mfa_required",
    });

    return { error: "Multi-factor authentication is required before entering a tenant." };
  }

  const existing = await getPlatformSession(context.service, context.admin);

  if (existing) {
    return { error: "Exit the current tenant before entering another." };
  }

  const { session, error } = await createPlatformSession(
    context.service,
    context.admin,
    parsed.data.organisationId,
    parsed.data.reason,
  );

  if (!session) {
    return { error: error ?? "The support session could not be created." };
  }

  await setPlatformSessionCookie(session.id, new Date(session.expiresAt));
  redirect("/platform/tenant");
}

export async function exitTenant() {
  const context = await getPlatformContext();

  if (context.ok) {
    const session = await getPlatformSession(context.service, context.admin);

    if (session) {
      await endPlatformSession(context.service, context.admin, session);
    }
  }

  await clearPlatformSessionCookie();
  redirect("/platform");
}

export async function startImpersonation(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    redirect("/platform/tenant?error=Select+a+valid+member.");
  }

  const context = await getPlatformContext();

  if (!context.ok || !context.canEnterTenant) {
    redirect("/platform/tenant?error=MFA+is+required+to+impersonate+a+member.");
  }

  const session = await getPlatformSession(context.service, context.admin);

  if (!session) {
    redirect("/platform?error=Enter+a+tenant+before+impersonating+a+member.");
  }

  const { data: profile } = await context.service
    .from("profiles")
    .select("id, auth_user_id, full_name, email, status, organisation_id")
    .eq("id", profileId)
    .eq("organisation_id", session.organisationId)
    .maybeSingle();

  if (!profile || profile.status !== "active" || !profile.email) {
    redirect("/platform/tenant?error=That+member+cannot+be+impersonated.");
  }

  const { data: generated, error: linkError } = await context.service.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });

  const tokenHash = generated?.properties?.hashed_token;

  if (linkError || !tokenHash) {
    redirect("/platform/tenant?error=That+member+has+no+usable+sign-in+account.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    redirect("/platform/tenant?error=Supabase+is+not+configured.");
  }

  const verified = await fetch(`${url.replace(/\/$/, "")}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });

  const sessionData = (await verified.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!verified.ok || !sessionData.access_token || !sessionData.refresh_token) {
    redirect("/platform/tenant?error=The+member+session+could+not+be+verified.");
  }

  const expiresAt = new Date(Date.now() + IMPERSONATION_MINUTES * 60 * 1000);

  await setImpersonationCookies(
    {
      actorAdminId: context.admin.id,
      actorEmail: context.email,
      targetProfileId: profile.id,
      targetAuthUserId: profile.auth_user_id,
      targetName: profile.full_name ?? profile.email,
      targetEmail: profile.email,
      organisationId: session.organisationId,
      reason: session.reason ?? null,
      startedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    {
      accessToken: sessionData.access_token,
      refreshToken: sessionData.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + (sessionData.expires_in ?? 3600),
    },
  );

  await context.service.from("platform_audit_logs").insert({
    platform_admin_id: context.admin.id,
    organisation_id: session.organisationId,
    action: "platform.impersonation_started",
    metadata: {
      target_profile_id: profile.id,
      target_email: profile.email,
      target_name: profile.full_name,
      reason: session.reason,
      expires_at: expiresAt.toISOString(),
    },
  });

  redirect("/workspace");
}

export async function stopImpersonation() {
  const state = await readImpersonation();

  if (state) {
    const service = createPlatformServiceClient();

    await service.from("platform_audit_logs").insert({
      platform_admin_id: state.actorAdminId,
      organisation_id: state.organisationId,
      action: "platform.impersonation_ended",
      metadata: {
        target_profile_id: state.targetProfileId,
        target_email: state.targetEmail,
        started_at: state.startedAt,
      },
    });
  }

  await clearImpersonationCookies();
  redirect("/platform/tenant");
}
