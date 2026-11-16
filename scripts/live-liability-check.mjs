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

async function submitInForm(page, form, buttonName) {
  await form.getByRole("button", { name: new RegExp(buttonName, "i") }).click();
  const feedback = form.locator('p[role="status"], p[role="alert"]');
  await feedback.first().waitFor({ timeout: 30000 });
  return { role: await feedback.first().getAttribute("role"), text: await feedback.first().innerText() };
}

const browser = await chromium.launch();
const results = {};

try {
  const alphaContext = await browser.newContext();
  const alpha = await signIn(alphaContext, accounts.alpha);

  await alpha.page.goto(`${baseUrl}/workspace/reconciliation`, { waitUntil: "networkidle" });

  const bodyBefore = await alpha.page.evaluate(() => document.body.textContent ?? "");
  const chainVisible = bodyBefore.includes("Quantity chain");
  const toleranceTableVisible = bodyBefore.includes("0.25%");

  const discrepancyForm = alpha.page.locator("form").filter({ has: alpha.page.locator("#dc-item") });
  const itemValues = await alpha.page
    .locator("#dc-item option")
    .evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));
  await alpha.page.locator("#dc-item").selectOption(itemValues[0]);
  await alpha.page.locator("#dc-type").selectOption("transport");
  await alpha.page.locator("#dc-expected").fill("5000");
  await alpha.page.locator("#dc-actual").fill("4000");
  const discrepancyResult = await submitInForm(alpha.page, discrepancyForm, "record discrepancy");

  await alpha.page.waitForLoadState("networkidle");

  const liabilityRow = alpha.page
    .locator("tr")
    .filter({ has: alpha.page.getByRole("button", { name: /^confirm liability$/i }) })
    .first();
  const liabilityForm = liabilityRow.locator("form").first();
  await liabilityForm.locator('input[name="unitCost"]').fill("900");
  await liabilityForm.getByRole("button", { name: /^confirm liability$/i }).click();

  await alpha.page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("tr")).some((row) =>
        (row.textContent ?? "").includes("₦900,000.00"),
      ),
    undefined,
    { timeout: 30000 },
  );

  const liabilityConfirmed = (await alpha.page.evaluate(() => document.body.textContent ?? "")).includes(
    "₦900,000.00",
  );

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);
  await beta.page.goto(`${baseUrl}/workspace/reconciliation`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");
  await betaContext.close();

  results.alpha = {
    chainVisible,
    toleranceTableVisible,
    discrepancyResult,
    liabilityConfirmed,
    pass:
      chainVisible &&
      toleranceTableVisible &&
      discrepancyResult.role === "status" &&
      liabilityConfirmed,
    consoleErrors: alpha.consoleErrors,
  };

  results.beta = {
    denied: betaBody.includes("You cannot view reconciliation."),
    leaks: betaBody.includes("₦900,000.00") || betaBody.includes("0.25%"),
    pass:
      betaBody.includes("You cannot view reconciliation.") &&
      !betaBody.includes("₦900,000.00") &&
      !betaBody.includes("0.25%"),
    consoleErrors: beta.consoleErrors,
  };

  await alphaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(
  results.alpha?.pass && results.beta?.pass
    ? "LIVE_LIABILITY_CHECKS_PASSED"
    : "LIVE_LIABILITY_CHECKS_FAILED",
);
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
