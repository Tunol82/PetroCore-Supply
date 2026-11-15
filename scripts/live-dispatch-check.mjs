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
  const stamp = Date.now().toString().slice(-6);
  const firstTrip = `TRIP-UI-A-${stamp}`;
  const secondTrip = `TRIP-UI-B-${stamp}`;

  await alpha.page.goto(`${baseUrl}/workspace/dispatch`, { waitUntil: "networkidle" });

  // Reset precondition: this check drives the truck and driver through the
  // assignment lifecycle, so start from a board with no active assignments.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const activeRelease = alpha.page.getByRole("button", { name: /^release$/i }).first();
    if ((await activeRelease.count()) === 0) break;

    await activeRelease.click();
    await activeRelease.waitFor({ state: "detached", timeout: 30000 });
  }

  await alpha.page.getByLabel("Trip number", { exact: true }).fill(firstTrip);
  const tripOne = await submitAndRead(alpha.page, "save trip");

  await pickOption(alpha.page, "#as-trip", firstTrip);
  await pickOption(alpha.page, "#as-truck", "DB-TRK-1");
  await pickOption(alpha.page, "#as-driver", "DB Driver");
  await alpha.page.locator("#as-role").selectOption("primary");
  const firstAssignment = await submitAndRead(alpha.page, "assign trip");

  await alpha.page.getByLabel("Trip number", { exact: true }).fill(secondTrip);
  const tripTwo = await submitAndRead(alpha.page, "save trip");

  await pickOption(alpha.page, "#as-trip", secondTrip);
  await pickOption(alpha.page, "#as-truck", "DB-TRK-1");
  await pickOption(alpha.page, "#as-driver", "DB Driver");
  const doubleBooking = await submitAndRead(alpha.page, "assign trip");

  const releaseRow = alpha.page
    .locator("tr")
    .filter({ hasText: firstTrip })
    .filter({ has: alpha.page.getByRole("button", { name: /^release$/i }) })
    .first();
  const releaseButton = releaseRow.getByRole("button", { name: /^release$/i });
  await releaseButton.click();
  await releaseButton.waitFor({ state: "detached", timeout: 30000 });

  await pickOption(alpha.page, "#as-trip", secondTrip);
  await pickOption(alpha.page, "#as-truck", "DB-TRK-1");
  await pickOption(alpha.page, "#as-driver", "DB Driver");
  const reassignment = await submitAndRead(alpha.page, "assign trip");

  results.alpha = {
    tripOne,
    tripTwo,
    firstAssignment,
    doubleBooking,
    reassignment,
    pass:
      tripOne.role === "status" &&
      firstAssignment.role === "status" &&
      tripTwo.role === "status" &&
      doubleBooking.role === "alert" &&
      doubleBooking.text.includes("already assigned") &&
      reassignment.role === "status",
    consoleErrors: alpha.consoleErrors,
  };

  await alphaContext.close();

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);

  await beta.page.goto(`${baseUrl}/workspace/dispatch`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");

  results.beta = {
    denied: betaBody.includes("You cannot view dispatch."),
    leaks: betaBody.includes(firstTrip) || betaBody.includes("DB-TRK-1"),
    pass: betaBody.includes("You cannot view dispatch.") && !betaBody.includes(firstTrip),
    consoleErrors: beta.consoleErrors,
  };

  await betaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_DISPATCH_CHECKS_PASSED" : "LIVE_DISPATCH_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
