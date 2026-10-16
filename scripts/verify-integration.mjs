// Explicitly invoked local/dev integration check. Never creates users in Clerk live.
// Credentials remain in memory; only synthetic users created here are cleaned up.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { build } from "esbuild";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";

const origin = "http://localhost:3000";
const production = parseEnv(await readFile(".env.production.local", "utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"), "Development Clerk required");
assert.ok(process.env.DATABASE_URL && process.env.DATABASE_URL !== production.DATABASE_URL, "Separate development database required");
await build({ entryPoints: ["lib/model.ts"], bundle: true, platform: "node", format: "esm", outfile: "outputs/integration-model.mjs" });
const { defaultAnswers, defaultSchedule } = await import("../outputs/integration-model.mjs");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const users = [];
let stage = "initialization";
let cleanupFailed = false;
async function request(path, token, method = "GET", body, requestOrigin = origin) {
  const headers = { Origin: requestOrigin, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${origin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
}
async function account() {
  const user = await clerk.users.createUser({ emailAddress: [`routinefit-${randomUUID()}+clerk_test@example.com`], password: `${randomBytes(30).toString("base64url")}!aA1`, firstName: "Synthetic", lastName: "Verification" });
  users.push(user.id);
  const session = await clerk.sessions.createSession({ userId: user.id });
  return (await clerk.sessions.getToken(session.id)).jwt;
}
try {
  stage = "unauthenticated rejection";
  assert.equal((await request("/api/state")).status, 401);
  stage = "synthetic Clerk sessions";
  const a = await account(), b = await account();
  stage = "authenticated empty state";
  assert.deepEqual(await (await request("/api/state", a)).json(), { state: null, revision: 0 });
  const state = { version: 1, consentAt: new Date().toISOString(), consentVersion: "2026-10-v1", answers: { ...defaultAnswers, name: "합성 검증" }, schedule: defaultSchedule, inbody: [], days: [] };
  stage = "save to Postgres";
  assert.equal((await request("/api/state", a, "PUT", { state, revision: 0, userId: users[1] })).status, 200);
  stage = "restore persisted state";
  const restored = await (await request("/api/state", a)).json();
  assert.equal(restored.state.answers.name, "합성 검증");
  assert.equal(restored.revision, 1);
  const row = await pool.query("SELECT revision FROM user_states WHERE user_id = $1", [users[0]]);
  assert.equal(row.rows[0].revision, 1);
  stage = "account isolation";
  assert.deepEqual(await (await request("/api/state", b)).json(), { state: null, revision: 0 });
  stage = "concurrent save protection";
  assert.equal((await request("/api/state", a, "PUT", { state, revision: 0 })).status, 409);
  assert.equal((await request("/api/state", a, "PUT", { state, revision: 1 })).status, 200);
  stage = "cross-site rejection";
  assert.equal((await request("/api/state", a, "DELETE", undefined, "https://untrusted.example")).status, 403);
  stage = "routine generation";
  const plan = await request("/api/plan", a, "POST", { answers: state.answers, schedule: state.schedule, mode: "core", history: [], checkin: { sleep: 7, energy: 3, stress: 3, minutes: 15, unwell: false, place: "home", busy: false } });
  assert.equal(plan.status, 200);
  assert.ok((await plan.json()).day.routines.length > 0);
  stage = "scoped deletion";
  assert.equal((await request("/api/state", b, "DELETE")).status, 200);
  assert.equal((await (await request("/api/state", a)).json()).revision, 2);
  assert.equal((await request("/api/state", a, "DELETE")).status, 200);
  assert.deepEqual(await (await request("/api/state", a)).json(), { state: null, revision: 0 });
  console.log("PASS: Clerk session -> authenticated API -> Neon persistence/restore, account isolation, CAS, CSRF, routine generation, scoped deletion.");
} catch (error) {
  // Never serialize third-party errors: they can contain request credentials.
  console.error(`FAIL at ${stage}: ${error instanceof assert.AssertionError ? "assertion" : "request"}`);
  process.exitCode = 1;
} finally {
  for (const id of users) {
    try { await pool.query("DELETE FROM user_states WHERE user_id = $1", [id]); } catch { cleanupFailed = true; }
    try { await clerk.users.deleteUser(id); } catch { cleanupFailed = true; }
  }
  await pool.end();
  console.log(cleanupFailed ? "WARNING: synthetic cleanup needs inspection." : "Synthetic users and test records cleaned up.");
  if (cleanupFailed) process.exitCode = 1;
}
