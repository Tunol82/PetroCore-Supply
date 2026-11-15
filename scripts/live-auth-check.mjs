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

const accounts = [
  {
    name: "alpha-admin",
    email: env.DEV_TEST_USER_EMAIL,
    password: env.DEV_TEST_USER_PASSWORD,
  },
  {
    name: "beta-owner",
    email: env.DEV_TEST_BETA_EMAIL,
    password: env.DEV_TEST_BETA_PASSWORD,
  },
  {
    name: "no-membership",
    email: env.DEV_TEST_PENDING_EMAIL,
    password: env.DEV_TEST_PENDING_PASSWORD,
  },
];

for (const account of accounts) {
  if (!account.email || !account.password) {
    throw new Error(
      `Missing credentials for ${account.name}. Run the provisioning steps described in docs/AI_HANDOVER.md.`,
    );
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

async function checkAlpha(browser) {
  const context = await browser.newContext();
  const { page, consoleErrors } = await signIn(context, accounts[0]);

  const heading = await page.locator("h1").first().innerText();
  const manageLinkVisible = await page.getByRole("link", { name: "Manage access" }).isVisible();

  await page.getByRole("link", { name: "Manage access" }).click();
  await page.waitForURL("**/workspace/access", { timeout: 30000 });
  const accessHeading = await page.getByRole("heading", { name: /Access for Alpha/ }).innerText();

  await context.close();

  return {
    heading,
    manageLinkVisible,
    accessHeading,
    pass: heading === "Alpha" && manageLinkVisible && accessHeading.includes("Alpha"),
    consoleErrors,
  };
}

async function checkBeta(browser) {
  const context = await browser.newContext();
  const { page, consoleErrors } = await signIn(context, accounts[1]);

  const heading = await page.locator("h1").first().innerText();
  const body = await page.evaluate(() => document.body.textContent ?? "");
  const manageLinkCount = await page.getByRole("link", { name: "Manage access" }).count();

  await page.goto(`${baseUrl}/workspace/access`, { waitUntil: "networkidle" });
  const denied = await page
    .getByRole("heading", { name: /You cannot manage access for this workspace/i })
    .isVisible();

  await context.close();

  return {
    heading,
    leaksAlpha: body.includes("Alpha"),
    manageLinkCount,
    accessDenied: denied,
    pass: heading === "Beta" && !body.includes("Alpha") && manageLinkCount === 0 && denied,
    consoleErrors,
  };
}

async function checkPending(browser) {
  const context = await browser.newContext();
  const { page, consoleErrors } = await signIn(context, accounts[2]);

  const heading = await page.locator("h1").first().innerText();
  const headingVisible = await page
    .getByRole("heading", { name: /not linked to a company yet/i })
    .isVisible();

  await context.close();

  return {
    heading,
    headingVisible,
    pass: headingVisible,
    consoleErrors,
  };
}

const browser = await chromium.launch();

try {
  const results = {
    alpha: await checkAlpha(browser),
    beta: await checkBeta(browser),
    pending: await checkPending(browser),
  };

  console.log(JSON.stringify(results, null, 2));

  const failed = Object.entries(results).filter(([, result]) => !result.pass).map(([name]) => name);

  if (failed.length > 0) {
    console.error(`FAILED: ${failed.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("LIVE_AUTH_CHECKS_PASSED");
  }
} finally {
  await browser.close();
}
