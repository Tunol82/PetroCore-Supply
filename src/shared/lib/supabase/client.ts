import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured. Add the public URL and anon key to your environment.");
  }

  return createBrowserClient(config.url, config.anonKey);
}
