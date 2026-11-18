import { cache } from "react";
import { createClient } from "@/shared/lib/supabase/server";
import { getCurrentTenant, type CurrentTenant } from "./current-tenant";

const PERMISSION_KEYS = [
  "audit.view",
  "inventory.manage",
  "inventory.view",
  "locations.manage",
  "locations.view_all",
  "organisation.manage",
  "procurement.manage",
  "procurement.view",
  "sales.manage",
  "sales.view",
  "transport.manage",
  "transport.view",
  "users.manage",
] as const;

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string | null } | null;
  tenant: CurrentTenant | null;
  permissions: Record<string, boolean>;
  can: (key: string) => boolean;
};

/**
 * Request-scoped session, tenant and permission context.
 *
 * The workspace layout and the page it wraps both need the same three things.
 * Wrapping this in React `cache` means they share one set of round trips per
 * request instead of repeating auth, tenant resolution and permission RPCs.
 *
 * Only call this after confirming Supabase is configured; pages keep their own
 * unconfigured state.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const user = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;

  if (!user) {
    return { supabase, user: null, tenant: null, permissions: {}, can: () => false };
  }

  const { tenant } = await getCurrentTenant(supabase, user.id);

  if (!tenant) {
    return { supabase, user, tenant: null, permissions: {}, can: () => false };
  }

  const results = await Promise.all(
    PERMISSION_KEYS.map((key) => supabase.rpc("has_permission", { p_permission_key: key })),
  );

  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key, index) => [key, Boolean(results[index].data)]),
  ) as Record<string, boolean>;

  return {
    supabase,
    user,
    tenant,
    permissions,
    can: (key: string) => permissions[key] === true,
  };
});
