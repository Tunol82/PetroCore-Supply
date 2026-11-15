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

for (const [name, account] of Object.entries(accounts)) {
  if (!account.email || !account.password) {
    throw new Error(`Missing credentials for ${name}.`);
  }
}

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

  await alpha.page.goto(`${baseUrl}/workspace/inventory`, { waitUntil: "networkidle" });
  const alphaBody = await alpha.page.evaluate(() => document.body.textContent ?? "");
  const heading = await alpha.page.locator("h1").first().innerText();
  const receiveButton = await alpha.page.getByRole("button", { name: /receive stock/i }).count();
  const batchCell = await alpha.page.getByText("BAT-472467").count();
  const movementRow = await alpha.page.getByRole("cell", { name: "receipt" }).count();
  const deniesBeta = !alphaBody.includes("Beta Depot");

  const receiptSelect = alpha.page.getByLabel("Procurement batch");
  const receiptCandidates = await receiptSelect.locator("option").count();
  let receiptResult = "no batch available";

  if (receiptCandidates > 1) {
    const batchText = await receiptSelect.locator("option").nth(1).innerText();
    receiptSelect.selectOption({ index: 1 });
    await alpha.page.getByLabel("Storage location").selectOption({ label: "Alpha Depot" });
    await alpha.page.getByLabel("Received quantity").fill("2000");
    await alpha.page.getByLabel("Landed cost per unit (optional)").fill("900");
    await alpha.page.getByRole("button", { name: /receive stock/i }).click();
    const feedback = alpha.page.locator('p[role="status"], p[role="alert"]');
    await feedback.first().waitFor({ timeout: 30000 });
    const message = await feedback.first().innerText();
    receiptResult = `${message} [${batchText.split(" · ")[0]}]`;
  }

  const afterReceipt = await alpha.page.evaluate(() => document.body.textContent ?? "");

  results.alpha = {
    heading,
    batchCell,
    movementRow,
    receiveButton,
    deniesBeta,
    receiptResult,
    pass:
      heading === "Alpha" &&
      batchCell > 0 &&
      movementRow > 0 &&
      receiveButton > 0 &&
      deniesBeta &&
      (receiptResult === "no batch available" || receiptResult.includes("Stock received")) &&
      (receiptResult === "no batch available" || afterReceipt.includes("2,000")),
    consoleErrors: alpha.consoleErrors,
  };

  await alphaContext.close();

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);

  await beta.page.goto(`${baseUrl}/workspace/inventory`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");
  const betaDenied = betaBody.includes("You cannot view inventory.");
  const betaLeaksAlpha = betaBody.includes("BAT-472467");

  results.beta = {
    betaDenied,
    betaLeaksAlpha,
    pass: betaDenied && !betaLeaksAlpha,
    consoleErrors: beta.consoleErrors,
  };

  await betaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_INVENTORY_CHECKS_PASSED" : "LIVE_INVENTORY_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
