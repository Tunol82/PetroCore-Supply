import { expect, test } from "@playwright/test";

test("shows the Deuces Supply foundation workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /a clearer view of every supply movement/i })).toBeVisible();
  await expect(page.getByText("No live business data or transactions are connected.")).toBeVisible();
});
