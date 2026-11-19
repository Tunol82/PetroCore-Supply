import fs from "node:fs";
import path from "node:path";

export type E2EEnv = {
  url: string;
  anonKey: string;
  serviceKey: string;
  ref: string;
  orgId: string;
  ownerEmail: string;
  viewerEmail: string;
  baseUrl: string;
};

const DEMO_PROJECT_REF = "pmsjntbwtswjygerozns";

/**
 * Loads `.env.e2e.local` without overriding variables already provided by the
 * shell or CI. The file is gitignored; secrets never reach the repository.
 */
export function loadE2EEnv() {
  const file = path.resolve(process.cwd(), ".env.e2e.local");

  if (!fs.existsSync(file)) {
    return;
  }

  for (const line of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function requireE2EEnv(): E2EEnv {
  loadE2EEnv();

  const url = process.env.E2E_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      "Authenticated E2E is not configured. Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY (see docs/testing/authenticated-e2e-scope.md).",
    );
  }

  return {
    url,
    anonKey,
    serviceKey,
    ref: new URL(url).hostname.split(".")[0],
    orgId: process.env.E2E_ORG_ID ?? "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    ownerEmail: process.env.E2E_OWNER_EMAIL ?? "e2e.owner@petrocore.test",
    viewerEmail: process.env.E2E_VIEWER_EMAIL ?? "e2e.viewer@petrocore.test",
    baseUrl: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
  };
}

/**
 * Refuses to run against an unexpected project. The demo project is allowed
 * only when E2E_ALLOW_DEMO_PROJECT=1, because the E2E tenant shares its
 * database with the demo tenants.
 */
export function assertSafeProject(env: E2EEnv) {
  const allowed = (process.env.E2E_ALLOWED_PROJECT_REF ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.length === 0 || !allowed.includes(env.ref)) {
    throw new Error(
      `Refusing to run authenticated E2E: project ref "${env.ref}" is not in E2E_ALLOWED_PROJECT_REF.`,
    );
  }

  if (env.ref === DEMO_PROJECT_REF && process.env.E2E_ALLOW_DEMO_PROJECT !== "1") {
    throw new Error(
      "Refusing to run against the demo project. Set E2E_ALLOW_DEMO_PROJECT=1 only when using the isolated ORG-E2E tenant.",
    );
  }
}
