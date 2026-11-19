import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const config = getSupabaseConfig();

  if (!config) {
    return response;
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes the session cookie when needed. Authorisation is still checked
  // on the server in each protected route/action.
  await supabase.auth.getUser();

  // An expired support session falls back to the administrator's own session.
  const impersonation = request.cookies.get("pc_impersonation_meta")?.value;

  if (impersonation) {
    let expired = true;

    try {
      const parsed = JSON.parse(impersonation) as { expiresAt?: string };
      expired = !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now();
    } catch {
      expired = true;
    }

    if (expired) {
      response.cookies.delete("pc_impersonation_meta");
      response.cookies.delete("pc_impersonation_tokens");
    }
  }

  return response;
}
