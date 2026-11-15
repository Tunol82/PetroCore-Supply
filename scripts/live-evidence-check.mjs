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

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

  await alpha.page.goto(`${baseUrl}/workspace/deliveries`, { waitUntil: "networkidle" });
  const heading = await alpha.page.locator("h1").first().innerText();

  const deliverySelect = alpha.page.locator("#ev-delivery");
  const deliveryOptions = await deliverySelect
    .locator("option")
    .evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));

  if (deliveryOptions.length === 0) {
    throw new Error("No delivery record available for the evidence check.");
  }

  const fileName = `waybill-check-${Date.now().toString().slice(-6)}.png`;
  await deliverySelect.selectOption(deliveryOptions[0]);
  await alpha.page.locator("#ev-type").selectOption("waybill");
  await alpha.page.getByLabel("Evidence file", { exact: true }).setInputFiles({
    name: fileName,
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await alpha.page.getByLabel("Notes", { exact: true }).fill("Live upload check");
  await alpha.page.getByRole("button", { name: /upload evidence/i }).click();

  await alpha.page.locator('form p[role="status"], form p[role="alert"]').first().waitFor({ timeout: 30000 });
  const message = await alpha.page.locator('form p[role="status"], form p[role="alert"]').first().innerText();

  const link = alpha.page.getByRole("link", { name: fileName });
  await link.waitFor({ timeout: 30000 });
  const signedUrl = await link.getAttribute("href");

  const fetchResult = signedUrl ? await alpha.page.request.get(signedUrl) : null;
  const contentType = fetchResult?.headers()["content-type"] ?? null;
  const status = fetchResult?.status() ?? 0;
  const bytes = fetchResult ? (await fetchResult.body()).length : 0;

  const betaContext = await browser.newContext();
  const beta = await signIn(betaContext, accounts.beta);
  await beta.page.goto(`${baseUrl}/workspace/deliveries`, { waitUntil: "networkidle" });
  const betaBody = await beta.page.evaluate(() => document.body.textContent ?? "");

  results.beta = {
    denied: betaBody.includes("You cannot view deliveries."),
    leaks: betaBody.includes(fileName),
    pass: betaBody.includes("You cannot view deliveries.") && !betaBody.includes(fileName),
    consoleErrors: beta.consoleErrors,
  };

  await betaContext.close();

  results.alpha = {
    heading,
    fileName,
    message,
    signed: Boolean(signedUrl),
    signedHost: signedUrl ? new URL(signedUrl).host : null,
    downloadStatus: status,
    contentType,
    bytes,
    pass:
      heading === "Alpha" &&
      message === "Evidence uploaded." &&
      Boolean(signedUrl) &&
      status === 200 &&
      contentType === "image/png" &&
      bytes === pngBuffer.length,
    consoleErrors: alpha.consoleErrors,
  };

  await alphaContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log(results.alpha?.pass && results.beta?.pass ? "LIVE_EVIDENCE_CHECKS_PASSED" : "LIVE_EVIDENCE_CHECKS_FAILED");
process.exitCode = results.alpha?.pass && results.beta?.pass ? 0 : 1;
