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
