import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";

export const IMPERSONATION_META_COOKIE = "pc_impersonation_meta";
export const IMPERSONATION_TOKENS_COOKIE = "pc_impersonation_tokens";
export const IMPERSONATION_MINUTES = 30;

export type ImpersonationState = {
  actorAdminId: string;
  actorEmail: string;
  targetProfileId: string;
  targetAuthUserId: string;
  targetName: string;
  targetEmail: string;
  organisationId: string;
  reason: string | null;
  startedAt: string;
  expiresAt: string;
};

type ImpersonationTokens = { accessToken: string; refreshToken: string; expiresAt: number };

async function readTokens(): Promise<ImpersonationTokens | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_TOKENS_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ImpersonationTokens;
    return parsed.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export async function readImpersonation(): Promise<ImpersonationState | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_META_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ImpersonationState;

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function setImpersonationCookies(
  state: ImpersonationState,
  tokens: ImpersonationTokens,
) {
  const store = await cookies();
  const expires = new Date(state.expiresAt);
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };

  store.set(IMPERSONATION_META_COOKIE, JSON.stringify(state), options);
  store.set(IMPERSONATION_TOKENS_COOKIE, JSON.stringify(tokens), options);
}

export async function clearImpersonationCookies() {
  const store = await cookies();
  store.delete(IMPERSONATION_META_COOKIE);
  store.delete(IMPERSONATION_TOKENS_COOKIE);
}

/**
 * Builds the tenant client for an impersonation session.
 *
 * A synthetic Supabase auth cookie carries the target user's tokens, so every
 * existing query, RPC and server action runs as the target under RLS — writes
 * included. The target's tokens never leave an httpOnly cookie.
 */
export async function createImpersonationClient(state: ImpersonationState) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  const tokens = await readTokens();

  if (!tokens) {
    return null;
  }

  const ref = new URL(config.url).hostname.split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  const session = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "bearer",
    expires_in: Math.max(0, tokens.expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: tokens.expiresAt,
    user: {
      id: state.targetAuthUserId,
      email: state.targetEmail,
      aud: "authenticated",
      role: "authenticated",
    },
  };

  // Matches the encoding used by @supabase/ssr for its auth cookie.
  const value = `base64-${Buffer.from(JSON.stringify(session))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return [{ name: cookieName, value }];
      },
      setAll() {
        // Refreshes during a support session are discarded; the session is
        // capped at 30 minutes, well inside the access token lifetime.
      },
    },
  });
}
