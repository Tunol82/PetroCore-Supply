export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Reads the public Supabase settings without throwing.
 *
 * The application must remain renderable before a Supabase project is
 * configured, so callers use this to decide whether to attempt a connection
 * instead of relying on an exception from `createClient`.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}
