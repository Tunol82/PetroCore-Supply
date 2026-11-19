import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafeProject, requireE2EEnv, type E2EEnv } from "./env";
import { writeSession, type CachedSession } from "./session";

const ADMIN_ROLE_ID = "e2e00000-0000-4000-8000-000000000001";
const VIEWER_ROLE_ID = "e2e00000-0000-4000-8000-000000000002";

type ServiceClient = SupabaseClient;
type VerifiedSession = {
  access_token?: string;
  refresh_token?: string;
  [key: string]: unknown;
};

async function ensureUser(
  service: ServiceClient,
  env: E2EEnv,
  email: string,
  fullName: string,
  roleId: string,
) {
  const { data: existingProfile, error: profileLookupError } = await service
    .from("profiles")
    .select("id, auth_user_id")
    .eq("organisation_id", env.orgId)
    .eq("email", email)
    .maybeSingle();

  if (profileLookupError) {
    throw profileLookupError;
  }

  let authUserId = existingProfile?.auth_user_id ?? null;

  if (authUserId) {
    const { data, error } = await service.auth.admin.getUserById(authUserId);

    if (error || !data.user) {
      authUserId = null;
    }
  }

  if (!authUserId) {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created?.user) {
      authUserId = created.user.id;
    } else {
      const { data: link, error: linkError } = await service.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkError || !link?.user) {
        throw new Error(
          `Could not prepare the auth user ${email}: ${createError?.message ?? linkError?.message ?? "unknown error"}`,
        );
      }

      authUserId = link.user.id;
    }
  }

  let profileId = existingProfile?.id ?? null;

  if (profileId) {
    const { error } = await service
      .from("profiles")
      .update({ auth_user_id: authUserId, full_name: fullName, status: "active", deactivated_at: null })
      .eq("id", profileId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await service
      .from("profiles")
      .insert({
        organisation_id: env.orgId,
        auth_user_id: authUserId,
        full_name: fullName,
        email,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Could not create the profile for ${email}: ${error?.message ?? "unknown error"}`);
    }

    profileId = data.id;
  }

  if (!profileId) {
    throw new Error(`Could not resolve the profile for ${email}.`);
  }

  const { error: roleDeleteError } = await service
    .from("user_roles")
    .delete()
    .eq("organisation_id", env.orgId)
    .eq("user_id", profileId);

  if (roleDeleteError) {
    throw roleDeleteError;
  }

  const { error: roleError } = await service.from("user_roles").insert({
    organisation_id: env.orgId,
    user_id: profileId,
    role_id: roleId,
  });

  if (roleError) {
    throw roleError;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSession(env: E2EEnv, email: string): Promise<CachedSession> {
  const service = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
      const tokenHash = data?.properties?.hashed_token;

      if (error || !tokenHash) {
        throw new Error(error?.message ?? "No sign-in token returned.");
      }

      const response = await fetch(`${env.url}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: env.anonKey,
          Authorization: `Bearer ${env.anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
      });

      const session = (await response.json()) as VerifiedSession;

      if (!response.ok || !session.access_token || !session.refresh_token) {
        throw new Error("Session verification failed.");
      }

      return {
        ...session,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 43_200,
      };
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await sleep(attempt * 1_500);
      }
    }
  }

  throw new Error(`Could not create a ${email} session: ${String(lastError)}`);
}

export default async function globalSetup() {
  const env = requireE2EEnv();
  assertSafeProject(env);
  const service = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let organisation = null;
  let organisationError: { message: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await service
      .from("organisations")
      .select("id")
      .eq("id", env.orgId)
      .maybeSingle();

    organisation = result.data;
    organisationError = result.error;

    if (organisation) {
      break;
    }

    if (attempt < 3) {
      await sleep(attempt * 1_500);
    }
  }

  if (!organisation) {
    throw new Error(
      `The E2E tenant could not be loaded (${organisationError?.message ?? "not found"}). Apply supabase/seed/e2e-tenant.sql to the configured project before running this suite.`,
    );
  }

  await ensureUser(service, env, env.ownerEmail, "E2E Owner", ADMIN_ROLE_ID);
  await ensureUser(service, env, env.viewerEmail, "E2E Viewer", VIEWER_ROLE_ID);

  writeSession("owner", await createSession(env, env.ownerEmail));
  writeSession("viewer", await createSession(env, env.viewerEmail));

  // Recover from an interrupted run. Only the E2E tenant and the run prefix
  // are touched; seeded fixtures and demo tenants are never deleted.
  await service
    .from("procurement_batches")
    .delete()
    .eq("organisation_id", env.orgId)
    .like("batch_number", "E2E-RUN-%");

  await service
    .from("suppliers")
    .delete()
    .eq("organisation_id", env.orgId)
    .like("supplier_code", "E2E-RUN-%");

  console.log(`Authenticated E2E ready against project ${env.ref} (${env.orgId}).`);
}
