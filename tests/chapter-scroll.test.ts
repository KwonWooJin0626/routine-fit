import test from "node:test";
import assert from "node:assert/strict";
import { resetChapterScroll } from "../lib/chapter-scroll";

function fixture() {
  const events: unknown[] = [];
  const panel = { scrollTop: 240, scrollLeft: 75, scrollTo(options: ScrollToOptions) { events.push(["panel", options]); this.scrollTop = options.top ?? this.scrollTop; } };
  const unchanged = { scrollTop: 0, scrollTo() { throw new Error("Already at top"); } };
  const heading = { hasAttribute: () => true, focus(options: FocusOptions) { events.push(["focus", options]); } };
  const root = {
    querySelector: () => heading,
    querySelectorAll: () => [panel, unchanged],
    scrollTo(options: ScrollToOptions) { events.push(["root", options]); },
    ownerDocument: { defaultView: { scrollTo(options: ScrollToOptions) { events.push(["page", options]); } } },
  } as unknown as HTMLElement;
  return { root, panel, events };
}
test("챕터 이동은 해당 영역과 내부 패널을 즉시 맨 위로 옮기고 가로 위치는 유지한다", () => {
  const { root, panel, events } = fixture();
  resetChapterScroll(root);
  assert.equal(panel.scrollTop, 0);
  assert.equal(panel.scrollLeft, 75);
  assert.deepEqual(events, [["focus", { preventScroll: true }], ["panel", { top: 0, behavior: "instant" }], ["root", { top: 0, behavior: "instant" }]]);
});
test("메뉴·계획 단계 이동에서는 문서도 초기화하고 팝업·시간표에서는 바깥 페이지를 보존한다", () => {
  const page = fixture(), dialog = fixture();
  resetChapterScroll(page.root, true);
  resetChapterScroll(dialog.root, false, false);
  assert.deepEqual(page.events.at(-1), ["page", { top: 0, behavior: "instant" }]);
  assert.equal(dialog.events.some(event => (event as string[])[0] === "page" || (event as string[])[0] === "focus"), false);
});
test("챕터 제목을 우선하고 제목이 없는 스크롤 영역도 정상 처리한다", () => {
  const preferred = fixture();
  const selectors: string[] = [];
  const lookup = preferred.root.querySelector.bind(preferred.root);
  preferred.root.querySelector = ((selector: string) => { selectors.push(selector); return lookup(selector); }) as typeof preferred.root.querySelector;
  resetChapterScroll(preferred.root);
  assert.deepEqual(selectors, ["[data-step-heading]"]);
  const { root, events } = fixture();
  root.querySelector = (() => null) as typeof root.querySelector;
  resetChapterScroll(root);
  assert.equal(events.some(event => (event as string[])[0] === "focus"), false);
  assert.deepEqual(events.at(-1), ["root", { top: 0, behavior: "instant" }]);
});
