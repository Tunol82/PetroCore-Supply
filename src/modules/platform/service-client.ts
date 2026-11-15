import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the platform module only.
 *
 * This bypasses RLS. Every query MUST be explicitly scoped to the resolved
 * tenant session and must be read-only. Never import this from a client
 * component and never return the client or key to the browser.
 */
export function createPlatformServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Platform access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
