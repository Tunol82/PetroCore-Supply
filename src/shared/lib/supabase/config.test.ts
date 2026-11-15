import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseConfig", () => {
  it("returns null when the project URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getSupabaseConfig()).toBeNull();
  });

  it("returns null when the anon key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(getSupabaseConfig()).toBeNull();
  });

  it("returns the configured project settings", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });
});
