import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const port = process.env.PORT ?? "3000";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stopExistingServer() {
  try {
    if (process.platform === "win32") {
      const pid = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
        ],
        { encoding: "utf8" },
      ).trim();

      if (pid) {
        execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
        console.log(`Stopped process ${pid} listening on port ${port}.`);
        return true;
      }
    } else {
      const output = execFileSync("bash", ["-lc", `lsof -ti tcp:${port} || true`], { encoding: "utf8" });
      const pids = output.trim().split(/\s+/).filter(Boolean);

      if (pids.length > 0) {
        execFileSync("kill", ["-9", ...pids]);
        console.log(`Stopped process ${pids.join(", ")} listening on port ${port}.`);
        return true;
      }
    }
  } catch {
    // Nothing listening, or the tool is unavailable. Starting the server will surface it.
  }

  return false;
}

// Windows keeps handles on .next for a moment after the server exits, so retry.
async function clearNextDir() {
  const target = path.join(root, ".next");

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      console.log("Cleared .next.");
      return;
    } catch (error) {
      if (attempt === 10) {
        throw error;
      }

      await sleep(400);
    }
  }
}

const stopped = stopExistingServer();

if (stopped) {
  await sleep(700);
}

await clearNextDir();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], { cwd: root, stdio: "inherit" });

child.on("exit", (code) => process.exit(code ?? 0));
