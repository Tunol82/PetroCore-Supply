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

async function pickOption(page, selector, includes) {
  const select = page.locator(selector);
  const options = await select
    .locator("option")
    .evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent ?? "" })));
  const match = options.find((option) => option.text.includes(includes));

  if (!match) {
    throw new Error(`No option matching "${includes}" in ${selector}: ${options.map((o) => o.text).join(" | ")}`);
  }

  await select.selectOption(match.value);
  return match.text;
}

async function submitAndRead(page, buttonName) {
  const button = page.getByRole("button", { name: new RegExp(buttonName, "i") }).first();
  const form = button.locator("xpath=ancestor::form");
  await button.click();
  const feedback = form.locator('p[role="status"], p[role="alert"]');
  await feedback.first().waitFor({ timeout: 30000 });
  return { role: await feedback.first().getAttribute("role"), text: await feedback.first().innerText() };
}

const browser = await chromium.launch();
const results = {};

try {
  const alphaContext = await browser.newContext();
  const alpha = await signIn(alphaContext, accounts.alpha);

  await alpha.page.goto(`${baseUrl}/workspace/inventory/fulfilment`, { waitUntil: "networkidle" });
  const heading = await alpha.page.locator("h1").first().innerText();
  const sections = await alpha.page.getByRole("heading", { level: 2 }).allInnerTexts();
  const seededAllocation = await alpha.page.getByText("₦900,000.00").count();

  const stamp = Date.now().toString().slice(-6);

  await pickOption(alpha.page, "#rs-order", "DB-SO-2");
  await pickOption(alpha.page, "#rs-location", "Alpha Depot");
  await alpha.page.getByLabel("Reservation number", { exact: true }).fill(`RES-UI-${stamp}`);
  const reservation = await submitAndRead(alpha.page, "create reservation");

  const batchLabel = await pickOption(alpha.page, "#ri-batch", "PMS 915996");
  await pickOption(alpha.page, "#ri-reservation", `RES-UI-${stamp}`);
  await pickOption(alpha.page, "#ri-item", "DB-SO-2");
  await alpha.page.getByLabel("Reserved quantity", { exact: true }).fill("100");
  const reservationLine = await submitAndRead(alpha.page, "reserve stock");

  await alpha.page.getByLabel("Issue number", { exact: true }).fill(`ISS-UI-${stamp}`);
  await pickOption(alpha.page, "#is-order", "DB-SO-2");
  await pickOption(alpha.page, "#is-location", "Alpha Depot");
  const issue = await submitAndRead(alpha.page, "create draft issue");

  await pickOption(alpha.page, "#il-issue", `ISS-UI-${stamp}`);
  await pickOption(alpha.page, "#il-item", "DB-SO-2");
  await alpha.page.getByLabel("Quantity to issue", { exact: true }).fill("150");
  const issueLine = await submitAndRead(alpha.page, "add issue line");

  await alpha.page.getByRole("button", { name: /post issue/i }).first().click();
  await alpha.page.waitForFunction(
    (issueNumber) =>
      Array.from(document.querySelectorAll("tr")).some(
        (row) => (row.textContent ?? "").includes(issueNumber) && (row.textContent ?? "").includes("posted"),
      ),
    `ISS-UI-${stamp}`,
    { timeout: 30000 },
  );
  const posted = { role: "status", text: "posted" };
  const bodyAfter = await alpha.page.evaluate(() => document.body.textContent ?? "");
  const fulfilledShown = bodyAfter.includes("fulfilled");

  await alpha.page.goto(`${baseUrl}/workspace/inventory`, { waitUntil: "networkidle" });
  const stockBody = await alpha.page.evaluate(() => document.body.textContent ?? "");
  const stockMoved = stockBody.includes("inventory issue");

  results.alpha = {
    heading,
    sections,
    seededAllocation,
    batchLabel,
    reservation,
    reservationLine,
    issue,
    issueLine,
    posted,
    fulfilledShown,
    stockMoved,
    pass:
      heading === "Alpha" &&
      sections.includes("Reservations") &&
      sections.includes("Issues") &&
      sections.includes("FIFO allocations") &&
      seededAllocation > 0 &&
      reservation.role === "status" &&
      reservationLine.role === "status" &&
      issue.role === "status" &&
      issueLine.role === "status" &&
      posted.role === "status" &&
      fulfilledShown &&
      stockMoved,
    consoleErrors: alpha.consoleErrors,
  };

  await alphaContext.close();

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);

  await beta.page.goto(`${baseUrl}/workspace/inventory/fulfilment`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");

  results.beta = {
    denied: betaBody.includes("You cannot view stock fulfilment."),
    leaks: betaBody.includes("RES-UI-") || betaBody.includes("DB-SO-2"),
    pass: betaBody.includes("You cannot view stock fulfilment.") && !betaBody.includes("RES-UI-"),
    consoleErrors: beta.consoleErrors,
  };

  await betaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_FULFILMENT_CHECKS_PASSED" : "LIVE_FULFILMENT_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;

