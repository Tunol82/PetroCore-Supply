import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env.local");
const baseUrl = process.env.LIVE_BASE_URL ?? "http://127.0.0.1:3000";

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = loadEnv();

const accounts = {
  alpha: { email: env.DEV_TEST_USER_EMAIL, password: env.DEV_TEST_USER_PASSWORD },
  beta: { email: env.DEV_TEST_BETA_EMAIL, password: env.DEV_TEST_BETA_PASSWORD },
};

async function signIn(context, account) {
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/workspace", { timeout: 30000 });
  await page.waitForLoadState("networkidle");

  return { page, consoleErrors };
}

async function readFeedback(page, form) {
  const feedback = form.locator('p[role="status"], p[role="alert"]');
  await feedback.first().waitFor({ timeout: 30000 });
  return { role: await feedback.first().getAttribute("role"), text: await feedback.first().innerText() };
}

async function selectFirstRealOption(selector) {
  const select = selector;
  const options = await select
    .locator("option")
    .evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));
  if (options.length === 0) throw new Error("No option available");
  await select.selectOption(options[0]);
  return options[0];
}

const browser = await chromium.launch();
const results = {};

try {
  const alphaContext = await browser.newContext();
  const alpha = await signIn(alphaContext, accounts.alpha);
  const stamp = Date.now().toString().slice(-6);

  // 1. Reverse a posted issue through the fulfilment page.
  await alpha.page.goto(`${baseUrl}/workspace/inventory/fulfilment`, { waitUntil: "networkidle" });

  const reverseRow = alpha.page
    .locator("tr")
    .filter({ has: alpha.page.getByRole("button", { name: /reverse issue/i }) })
    .first();
  const issueNumber = (await reverseRow.locator("td").first().innerText()).trim();
  const reverseForm = reverseRow.locator("form");
  await reverseForm.locator('input[name="reason"]').fill("Live reversal check");
  await reverseForm.getByRole("button", { name: /reverse issue/i }).click();
  await alpha.page.waitForFunction(
    (number) =>
      Array.from(document.querySelectorAll("tr")).some(
        (row) => (row.textContent ?? "").includes(number) && (row.textContent ?? "").includes("reversed"),
      ),
    issueNumber,
    { timeout: 30000 },
  );
  const reversal = { role: "status", text: `reversed ${issueNumber}` };

  // 2. Record a transporter invoice and one line.
  await alpha.page.goto(`${baseUrl}/workspace/transport-invoices`, { waitUntil: "networkidle" });
  const invoiceNumber = `TI-UI-${stamp}`;
  const invoiceForm = alpha.page.locator("form").filter({ has: alpha.page.locator("#ti-number") });
  await alpha.page.locator("#ti-number").fill(invoiceNumber);
  await selectFirstRealOption(alpha.page.locator("#ti-transporter"));
  await alpha.page.locator("#ti-date").fill(new Date().toISOString().slice(0, 10));
  await alpha.page.locator("#ti-subtotal").fill("150000");
  await alpha.page.locator("#ti-tax").fill("7500");
  await invoiceForm.getByRole("button", { name: /record invoice/i }).click();
  const invoiceResult = await readFeedback(alpha.page, invoiceForm);

  await alpha.page.goto(`${baseUrl}/workspace/transport-invoices`, { waitUntil: "networkidle" });
  const lineForm = alpha.page.locator("form").filter({ has: alpha.page.locator("#il-invoice") });
  const invoiceOptions = await alpha.page
    .locator("#il-invoice option")
    .evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent ?? "" })));
  const targetInvoice = invoiceOptions.find((option) => option.text.includes(invoiceNumber));
  if (!targetInvoice) throw new Error("New invoice missing from line form");
  await alpha.page.locator("#il-invoice").selectOption(targetInvoice.value);
  await alpha.page.locator("#il-description").fill("Haulage");
  await alpha.page.locator("#il-quantity").fill("1");
  await alpha.page.locator("#il-rate").fill("150000");
  await lineForm.getByRole("button", { name: /add line/i }).click();
  const lineResult = await readFeedback(alpha.page, lineForm);

  const invoiceBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  // 3. Record a customer receipt and inspect profitability.
  await alpha.page.goto(`${baseUrl}/workspace/finance`, { waitUntil: "networkidle" });
  const paymentForm = alpha.page.locator("form").filter({ has: alpha.page.locator("#pm-amount") });
  await selectFirstRealOption(alpha.page.locator("#pm-customer"));
  await alpha.page.locator("#pm-amount").fill("123456");
  await alpha.page.locator("#pm-reference").fill(`RCPT-${stamp}`);
  await alpha.page.getByRole("button", { name: /record payment/i }).click();
  const paymentResult = await readFeedback(alpha.page, paymentForm);

  await alpha.page.goto(`${baseUrl}/workspace/finance`, { waitUntil: "networkidle" });
  const financeBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  // 4. Tenant isolation.
  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);
  await beta.page.goto(`${baseUrl}/workspace/finance`, { waitUntil: "networkidle" });
  const betaFinance = await beta.page.evaluate(() => document.body.textContent ?? "");
  await beta.page.goto(`${baseUrl}/workspace/transport-invoices`, { waitUntil: "networkidle" });
  const betaInvoices = await beta.page.evaluate(() => document.body.textContent ?? "");
  await betaContext.close();

  results.alpha = {
    issueNumber,
    reversal,
    invoiceNumber,
    invoiceResult,
    lineResult,
    invoiceTotalVisible: invoiceBody.includes("₦157,500.00"),
    liabilityNotAssessed: invoiceBody.includes("not assessed"),
    paymentResult,
    receiptVisible: financeBody.includes("₦123,456.00"),
    profitabilityVisible: financeBody.includes("Operational profitability"),
    pass:
      reversal.text.startsWith("reversed") &&
      invoiceResult.role === "status" &&
      lineResult.role === "status" &&
      invoiceBody.includes(invoiceNumber) &&
      invoiceBody.includes("₦157,500.00") &&
      invoiceBody.includes("not assessed") &&
      paymentResult.role === "status" &&
      financeBody.includes("₦123,456.00") &&
      financeBody.includes("Operational profitability"),
    consoleErrors: alpha.consoleErrors,
  };

  results.beta = {
    financeDenied: betaFinance.includes("You cannot view finance records."),
    invoicesDenied: betaInvoices.includes("You cannot view transporter invoices."),
    leaks: betaFinance.includes("RCPT-") || betaInvoices.includes(invoiceNumber),
    pass:
      betaFinance.includes("You cannot view finance records.") &&
      betaInvoices.includes("You cannot view transporter invoices.") &&
      !betaFinance.includes("RCPT-") &&
      !betaInvoices.includes(invoiceNumber),
    consoleErrors: beta.consoleErrors,
  };

  await alphaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_FINANCE_CHECKS_PASSED" : "LIVE_FINANCE_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
