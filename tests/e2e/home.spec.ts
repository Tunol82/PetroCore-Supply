import { expect, test } from "@playwright/test";

test("presents PetroCore Supply as the product identity", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /a clearer view of every supply movement/i }),
  ).toBeVisible();
  await expect(page.getByText("PETROCORE SUPPLY", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No live business data or transactions are connected."),
  ).toBeVisible();
});

test("exposes a labelled sign-in form", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: /sign in to your account/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});

test("reports an invalid email inline and marks the field", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email address")).toBeFocused();
});

test("shows a setup state instead of failing when Supabase is not configured", async ({ page }) => {
  await page.goto("/workspace");

  await expect(
    page.getByRole("heading", { name: /the secure connection is not configured/i }),
  ).toBeVisible();
  await expect(page.getByText("No tenant or business data has been assumed")).toBeVisible();
});

test("sets baseline security headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("reports configuration status without exposing secrets", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", supabaseConfigured: false });
  expect(response.headers()["cache-control"]).toContain("no-store");
});
