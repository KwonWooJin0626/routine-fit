import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { NutritionGuide } from "../components/nutrition-guide";
import { DailyCheckin } from "../components/daily-checkin";
import { defaultAnswers, defaultSchedule, initialCheckin, type AppState } from "../lib/model";
import { buildDay } from "../lib/engine";

const answers={...defaultAnswers,name:"합성 화면"};
const state:AppState={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers,schedule:defaultSchedule,inbody:[],days:[]};
test("성분을 먼저 보여주고 음식 미확인·실상품 미연동 범위를 숨기지 않는다",()=>{
  const html=renderToStaticMarkup(<NutritionGuide state={state} busy={false} onSave={async()=>{}} onEdit={()=>{}}/>);
  assert.ok(html.includes("먼저 살펴볼 성분"));assert.ok(html.includes("음식·섭취 프로필"));assert.ok(html.includes("가격·재고 API는 연결되지 않았어요"));
  assert.ok(!html.includes('href="https://kr.iherb.com'));
});
test("영양정보 미동의는 후보·제품 탐색을 노출하지 않는다",()=>{
  const html=renderToStaticMarkup(<NutritionGuide state={{...state,answers:{...answers,supplementOptIn:false}}} busy={false} onSave={async()=>{}} onEdit={()=>{}}/>);
  assert.ok(!html.includes("다른 영양소·보충 성분 둘러보기"));
});
test("즉흥형과 계획형 체크인은 다른 진입 설명과 단계를 사용한다",()=>{
  const c=initialCheckin(answers),props={initial:c,busy:false,error:"",onSubmit(){},onClose(){},preview:()=>buildDay(answers,c,"core",defaultSchedule)};
  const quick=renderToStaticMarkup(<DailyCheckin {...props} style="spontaneous"/>);
  const planned=renderToStaticMarkup(<DailyCheckin {...props} style="planned"/>);
  assert.ok(quick.includes("CHECK-IN 1 / 8"));assert.ok(planned.includes("CHECK-IN 1 / 5"));assert.ok(planned.includes("등록된 일정은 다시 묻지 않아요"));
});
