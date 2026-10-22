import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Onboarding } from "../components/forms";
import { ServiceWalkthrough } from "../components/service-walkthrough";
import { defaultAnswers } from "../lib/model";

const props = { busy: false, error: "", onClose() {}, onComplete() {} };
test("새 사용자는 첫 질문 전에 즉흥형·계획형 시작 방식을 선택한다", () => {
  const html = renderToStaticMarkup(createElement(Onboarding, props));
  assert.ok(html.includes("나에게 맞는 시작 방식"));
  assert.ok(html.includes("즉흥형"));
  assert.ok(html.includes("계획형"));
  assert.ok(!html.includes("어떻게 불러드릴까요?"));
});
test("기존 프로필과 초안은 안내를 강제 반복하지 않고 질문을 이어간다", () => {
  const initial = renderToStaticMarkup(createElement(Onboarding, { ...props, initial: { ...defaultAnswers, name: "합성 예시" } }));
  const draft = renderToStaticMarkup(createElement(Onboarding, { ...props, draft: { answers: { ...defaultAnswers, name: "합성 초안" }, step: 1 } }));
  assert.ok(initial.includes("어떻게 불러드릴까요?"));
  assert.ok(initial.includes("서비스 이용방법 보기"));
  assert.ok(draft.includes("평소 잠드는 시간"));
  assert.ok(draft.includes("data-step-heading"));
  assert.ok(!draft.includes("미리 체험하는 예시 화면"));
});
test("안내는 계획 모드·영양 안전·선택적 InBody·실천 기록과 입력 역할을 설명한다", () => {
  const screens = [0, 1, 2, 3].map(step => renderToStaticMarkup(createElement(ServiceWalkthrough, { step, onStepChange() {}, onStart() {}, resume: false })));
  assert.ok(screens.every(screen => screen.includes("실제 답변·기록에 저장되지 않아요")));
  assert.ok(screens[1].includes("전체 계획을 원할 때만"));
  assert.ok(screens[2].includes("안전정보를 확인해주세요"));
  assert.ok(screens[2].includes("InBody는 선택"));
  assert.ok(screens[2].includes("iHerb 검색"));
  assert.ok(screens[3].includes("내 첫 질문 시작하기"));
  assert.ok(screens[3].includes('type="checkbox"'));
});
