import { requireE2EEnv } from "./env";
import { expect, selectByText, serviceClient, signIn, test } from "./fixtures";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const batchNumber = `E2E-RUN-${runId}-BAT`;

test.beforeAll(async () => {
  const env = requireE2EEnv();
  const service = serviceClient();
  await service
    .from("procurement_batches")
    .delete()
    .eq("organisation_id", env.orgId)
    .like("batch_number", "E2E-RUN-%");
});

test.afterAll(async () => {
  const env = requireE2EEnv();
  const service = serviceClient();
  await service
    .from("procurement_batches")
    .delete()
    .eq("organisation_id", env.orgId)
    .eq("batch_number", batchNumber);
});

test("captures invoice pricing and reports price variance in the match", async ({ page }) => {
  await signIn(page, "owner");

  await page.goto("/workspace/procurement?tab=batches");
  const form = page.locator("form").filter({ has: page.locator("#batch-number") });

  await form.locator("#batch-number").fill(batchNumber);
  await selectByText(page, "#batch-supplier", "E2E Supplier");
  await selectByText(page, "#batch-depot", "E2E Supplier Depot");
  await selectByText(page, "#batch-product", "E2E Petrol");
  await selectByText(page, "#batch-po-line", "E2E-PO-1");
  await form.locator("#batch-supplier-qty").fill("1000");
  await form.locator("#batch-loaded-qty").fill("1000");
  await form.locator("#batch-received-qty").fill("1000");
  await selectByText(page, "#batch-location", "E2E Depot");
  await form.locator("#batch-invoice").fill(`E2E-RUN-${runId}-INV`);
  await form.locator("#batch-invoice-price").fill("950");
  await form.locator("#batch-invoice-amount").fill("950000");
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText("Procurement batch recorded.").first()).toBeVisible();

  await page.goto("/workspace/procurement?tab=matching");
  await expect(page.getByText("Three-way match", { exact: true })).toBeVisible();

  const row = page.locator("tbody tr", { hasText: "E2E Petrol" }).first();
  await expect(row).toContainText(/price variance/i);
  await expect(row).toContainText("950.00");
  await expect(row).toContainText("+50.00");
  await expect(row).toContainText("950,000.00");
  await expect(row).toContainText("+50,000.00");
});
