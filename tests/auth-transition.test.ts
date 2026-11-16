import test from "node:test";
import assert from "node:assert/strict";
import { authDestination } from "../lib/auth-destination";
import { parseLegacyAccountLinks } from "../lib/auth-owner";

test("Google 로그인 후 기존 가져오기와 수면 확인 경로를 복원한다", () => {
  assert.equal(authDestination("/import"), "/import");
  assert.equal(authDestination("/sleep/confirm?token=test.data&extra=1"), "/sleep/confirm?token=test.data");
});

test("로그인 복귀가 외부 주소 또는 허용하지 않은 경로로 이동하지 않는다", () => {
  for (const value of ["//other.example", "https://other.example", "/\\other.example", "/auth/callback", "/unknown"]) {
    assert.equal(authDestination(value), "/?start=1");
  }
});

test("확인된 Supabase 사용자만 자신의 기존 데이터 소유자에 연결한다", () => {
  const first = "4c86e267-9d5b-4ed6-8b8d-9ec5e43c6530";
  const second = "8f195616-b739-4da0-b767-3d773d3a3f0f";
  const links = parseLegacyAccountLinks(JSON.stringify({ [first]: "user_A" }));
  assert.equal(links.get(first), "user_A");
  assert.equal(links.get(second) ?? second, second);
  assert.throws(() => parseLegacyAccountLinks(JSON.stringify({ [first]: "user_A", [second]: "user_A" })));
  assert.throws(() => parseLegacyAccountLinks(JSON.stringify({ "member@example.test": "user_A" })));
});
