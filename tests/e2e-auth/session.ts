import fs from "node:fs";
import path from "node:path";

export type E2ERole = "owner" | "viewer";

export type CachedSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  [key: string]: unknown;
};

const authDir = path.resolve(process.cwd(), "tests/e2e-auth/.auth");

function sessionFile(role: E2ERole) {
  return path.join(authDir, `${role}.json`);
}

export function writeSession(role: E2ERole, session: CachedSession) {
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(sessionFile(role), JSON.stringify(session), "utf8");
}

export function readSession(role: E2ERole): CachedSession {
  const file = sessionFile(role);

  if (!fs.existsSync(file)) {
    throw new Error(`Missing cached ${role} session. Run the suite again so global setup can create it.`);
  }

  const session = JSON.parse(fs.readFileSync(file, "utf8")) as CachedSession;

  if (!session.access_token || session.expires_at * 1000 < Date.now() + 60_000) {
    throw new Error(`The cached ${role} session is missing or expired. Run the suite again.`);
  }

  return session;
}
