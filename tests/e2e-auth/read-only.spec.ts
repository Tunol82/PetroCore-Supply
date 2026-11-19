import { expect, signIn, test } from "./fixtures";

test("a view-only member sees data without management controls", async ({ page }) => {
  await signIn(page, "viewer");

  await page.goto("/workspace/procurement?tab=suppliers");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Deactivate|Reactivate/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.locator("#supplier-code")).toHaveCount(0);

  await page.goto("/workspace/sales?tab=customers");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Deactivate|Reactivate/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.locator("#cust-code")).toHaveCount(0);
});
