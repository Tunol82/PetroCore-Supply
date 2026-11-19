import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for tenant member administration only.
 *
 * It exists to invite auth users (which needs the admin API) and to write the
 * append-only audit row for member changes. Every call site must first verify
 * `users.manage`, resolve the caller's organisation, and scope every query to
 * that organisation. Never import this from a client component.
 */
export function createMemberServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Member administration requires the service role key.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
