"use server";

import { redirect } from "next/navigation";
import { getPlatformContext } from "@/modules/platform/authorization";
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
