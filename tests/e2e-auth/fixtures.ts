import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { requireE2EEnv } from "./env";
import { readSession, type E2ERole } from "./session";

export const test = base;
export { expect } from "@playwright/test";

export function serviceClient() {
  const env = requireE2EEnv();

  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Adds the cached session cookie created by global setup. No network call is
 * made here, so a flaky auth endpoint cannot fail an individual test.
 */
export async function signIn(page: Page, role: E2ERole) {
  const env = requireE2EEnv();
  const session = readSession(role);

  const value = `base64-${Buffer.from(JSON.stringify(session))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  await page.context().addCookies([
    {
      name: `sb-${env.ref}-auth-token`,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

export async function selectByText(page: Page, selector: string, text: string) {
  const option = page.locator(`${selector} option`).filter({ hasText: text }).first();
  await option.waitFor({ state: "attached" });
  const value = await option.getAttribute("value");

  if (!value) {
    throw new Error(`No option matching "${text}" in ${selector}.`);
  }

  await page.locator(selector).selectOption(value);
}
