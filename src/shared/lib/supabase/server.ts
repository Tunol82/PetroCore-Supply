import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import {
  createImpersonationClient,
  readImpersonation,
} from "@/modules/platform/impersonation";

export async function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured. Add the public URL and anon key to your environment.");
  }

  // A support session acts as the target user for every query and action.
  const impersonation = await readImpersonation();

  if (impersonation) {
    const impersonating = await createImpersonationClient(impersonation);

    if (impersonating) {
      return impersonating;
    }
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The request proxy refreshes sessions.
        }
      },
    },
  });
}
