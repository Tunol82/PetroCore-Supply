import { requireE2EEnv } from "./env";
import { expect, serviceClient, signIn, test } from "./fixtures";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const supplierCode = `E2E-RUN-${runId}-SUP`;

test.afterAll(async () => {
  const env = requireE2EEnv();
  const service = serviceClient();
  await service.from("suppliers").delete().eq("organisation_id", env.orgId).eq("supplier_code", supplierCode);
});

test("creates, edits, deactivates and reactivates a supplier", async ({ page }) => {
  await signIn(page, "owner");

  await page.goto("/workspace/procurement?tab=suppliers");
  const form = page.locator("form").filter({ has: page.locator("#supplier-code") });
  await form.locator("#supplier-code").fill(supplierCode);
  await form.locator("#supplier-name").fill("E2E Run Supplier");
  await form.locator("#supplier-phone").fill("0800 000 0099");
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText("Supplier saved.").first()).toBeVisible();

  let row = page.locator("tr", { hasText: supplierCode });
  await expect(row).toBeVisible();

  await row.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("Edit supplier", { exact: true }).first()).toBeVisible();
  await expect(form.locator("#supplier-code")).toHaveValue(supplierCode);
  await form.locator("#supplier-name").fill("E2E Run Supplier v2");
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText("Supplier updated.").first()).toBeVisible();

  row = page.locator("tr", { hasText: supplierCode });
  await expect(row).toContainText("E2E Run Supplier v2");

  await row.getByRole("button", { name: /Deactivate/ }).click();
  await expect(page.getByText("Supplier deactivated.").first()).toBeVisible();
  await expect(row.getByText("inactive")).toBeVisible();

  await page.goto("/workspace/procurement?tab=orders");
  const supplierOptions = await page.locator("#po-supplier option").allTextContents();
  expect(supplierOptions.join(" ")).not.toContain(supplierCode);

  await page.goto("/workspace/procurement?tab=suppliers");
  row = page.locator("tr", { hasText: supplierCode });
  await row.getByRole("button", { name: /Reactivate/ }).click();
  await expect(page.getByText("Supplier reactivated.").first()).toBeVisible();
  await expect(row.getByText("active")).toBeVisible();
});
