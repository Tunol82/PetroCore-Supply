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
const organisationCode = process.env.LIVE_ORGANISATION_CODE ?? "ORG-A";

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

const browser = await chromium.launch();
const results = {};

try {
  const alphaContext = await browser.newContext();
  const alpha = await signIn(alphaContext, accounts.alpha);

  await alpha.page.goto(`${baseUrl}/workspace/settings`, { waitUntil: "networkidle" });

  await alpha.page.getByLabel(`Type ${organisationCode} to confirm`).fill("WRONG");
  await alpha.page.getByRole("button", { name: /clear demo data/i }).click();
  const wrongFeedback = alpha.page.locator('form p[role="alert"]');
  await wrongFeedback.first().waitFor({ timeout: 30000 });
  const wrongText = await wrongFeedback.first().innerText();

  await alpha.page.getByLabel(`Type ${organisationCode} to confirm`).fill(organisationCode);
  await alpha.page.getByRole("button", { name: /clear demo data/i }).click();
  const status = alpha.page.locator('form p[role="status"]');
  await status.first().waitFor({ timeout: 60000 });
  const resetText = await status.first().innerText();

  await alpha.page.goto(`${baseUrl}/workspace/reconciliation`, { waitUntil: "networkidle" });
  const reconciliationBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  await alpha.page.goto(`${baseUrl}/workspace/inventory`, { waitUntil: "networkidle" });
  const inventoryBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  await alpha.page.goto(`${baseUrl}/workspace/finance`, { waitUntil: "networkidle" });
  const financeBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  await alpha.page.goto(`${baseUrl}/workspace/procurement`, { waitUntil: "networkidle" });
  const procurementBody = await alpha.page.evaluate(() => document.body.textContent ?? "");

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);
  await beta.page.goto(`${baseUrl}/workspace/settings`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");
  await betaContext.close();

  results.alpha = {
    wrongText,
    resetText,
    reconciliationCleared: reconciliationBody.includes("No reconciliations yet."),
    inventoryCleared: inventoryBody.includes("No stock has been received yet."),
    financeCleared: financeBody.includes("No payments recorded yet."),
    masterDataKept: procurementBody.includes("PMS 915996") || procurementBody.includes("AGO 472467"),
    pass:
      wrongText.includes("does not match") &&
      resetText.includes("Demo data cleared") &&
      reconciliationBody.includes("No reconciliations yet.") &&
      inventoryBody.includes("No stock has been received yet.") &&
      financeBody.includes("No payments recorded yet.") &&
      (procurementBody.includes("PMS 915996") || procurementBody.includes("AGO 472467")),
    consoleErrors: alpha.consoleErrors,
  };

  results.beta = {
    denied: betaBody.includes("You cannot manage organisation settings."),
    leaks: betaBody.includes(organisationCode) && betaBody.includes("Clear demo data"),
    pass:
      betaBody.includes("You cannot manage organisation settings.") &&
      !betaBody.includes("Clear demo data"),
    consoleErrors: beta.consoleErrors,
  };

  await alphaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_RESET_CHECKS_PASSED" : "LIVE_RESET_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
