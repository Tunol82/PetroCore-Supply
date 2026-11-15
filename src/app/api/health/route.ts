import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Liveness and configuration probe.
 *
 * Reports only whether the public Supabase settings are present. It never
 * returns keys, project references or tenant data.
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      supabaseConfigured: getSupabaseConfig() !== null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
