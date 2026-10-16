import test from "node:test";
import assert from "node:assert/strict";
import { createStateHandlers, type StateRepository, type StateRow } from "../lib/state-api";
import { defaultAnswers, defaultSchedule, type AppState } from "../lib/model";

const origin = "https://routine.test";
const state: AppState = { version: 1, consentAt: new Date().toISOString(), consentVersion: "2026-10-v1", answers: { ...defaultAnswers, name: "합성 테스트" }, schedule: defaultSchedule, inbody: [], days: [] };
function setup() {
  const rows = new Map<string, StateRow>();
  let signedIn: string | null = null;
  const repository: StateRepository = {
    async get(id) { return rows.get(id) ?? null; },
    async save(id, payload, expected) {
      const old = rows.get(id);
      if ((old?.revision ?? 0) !== expected) return null;
      const revision = expected + 1;
      rows.set(id, { payload, revision }); return revision;
    },
    async remove(id) { rows.delete(id); },
  };
  return { handlers: createStateHandlers(async () => signedIn, repository), rows, login: (id: string | null) => { signedIn = id; } };
}
const request = (body: unknown, requestOrigin = origin) => new Request(`${origin}/api/state`, { method: "PUT", headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("인증 없는 요청과 방문자가 위조한 사용자 헤더는 데이터를 얻지 못한다", async () => {
  const { handlers, rows } = setup();
  assert.equal((await handlers.GET()).status, 401);
  const forged = request({ state, revision: 0, userId: "victim" });
  forged.headers.set("oai-authenticated-user-id", "victim");
  forged.headers.set("x-clerk-user-id", "victim");
  assert.equal((await handlers.PUT(forged)).status, 401);
  assert.equal(rows.size, 0);
});
test("저장·복원·수정은 세션 소유자만 사용하고 오래된 revision은 거절한다", async () => {
  const { handlers, login, rows } = setup(); login("user-a");
  assert.deepEqual(await (await handlers.GET()).json(), { state: null, revision: 0 });
  assert.equal((await handlers.PUT(request({ state, revision: 0, userId: "user-b" }))).status, 200);
  assert.equal(rows.has("user-b"), false);
  assert.equal((await (await handlers.GET()).json()).state.answers.name, state.answers.name);
  assert.equal((await handlers.PUT(request({ state, revision: 0 }))).status, 409);
  assert.equal((await handlers.PUT(request({ state, revision: 1 }))).status, 200);
  assert.equal((await handlers.PUT(request({ state, revision: 1 }))).status, 409);
  login("user-b");
  assert.deepEqual(await (await handlers.GET()).json(), { state: null, revision: 0 });
  await handlers.DELETE(new Request(`${origin}/api/state`, { method: "DELETE", headers: { Origin: origin } }));
  assert.ok(rows.has("user-a"));
  login("user-a");
  assert.equal((await handlers.DELETE(new Request(`${origin}/api/state`, { method: "DELETE", headers: { Origin: origin } }))).status, 200);
  assert.equal(rows.size, 0);
});
test("타 사이트 저장·삭제, 잘못된 데이터, 과도한 요청을 거절한다", async () => {
  const { handlers, login } = setup(); login("user-a");
  assert.equal((await handlers.PUT(request({ state, revision: 0 }, "https://evil.test"))).status, 403);
  assert.equal((await handlers.DELETE(new Request(`${origin}/api/state`, { method: "DELETE", headers: { Origin: "https://evil.test" } }))).status, 403);
  assert.equal((await handlers.PUT(request({ state: {}, revision: 0 }))).status, 400);
  assert.equal((await handlers.PUT(request("x".repeat(500001)))).status, 413);
});
test("이전 파일 가져오기는 기존 데이터를 revision 0으로 덮어쓸 수 없다", async () => {
  const { handlers, login } = setup(); login("user-a");
  await handlers.PUT(request({ state, revision: 0 }));
  const replacement = { ...state, answers: { ...state.answers, name: "덮어쓰기 시도" } };
  assert.equal((await handlers.PUT(request({ state: replacement, revision: 0 }))).status, 409);
  assert.equal((await (await handlers.GET()).json()).state.answers.name, state.answers.name);
});
