import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { NutritionGuide } from "../components/nutrition-guide";
import { DailyCheckin } from "../components/daily-checkin";
import { defaultAnswers, defaultSchedule, initialCheckin, type AppState,type Checkin } from "../lib/model";
import { buildDay } from "../lib/engine";

const answers={...defaultAnswers,name:"합성 화면"};
const state:AppState={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers,schedule:defaultSchedule,inbody:[],days:[]};
test("일정 가이드를 먼저 보여주고 음식 미확인·실상품 미연동 범위를 숨기지 않는다",()=>{
  const html=renderToStaticMarkup(<NutritionGuide state={state} busy={false} onSave={async()=>{}} onEdit={()=>{}}/>);
  assert.ok(html.includes("일정에서 시작하는 영양 관리"));assert.ok(html.includes("음식·섭취 프로필"));assert.ok(html.includes("가격·재고 API는 연결되지 않았어요"));
  assert.ok(!html.includes('href="https://kr.iherb.com'));
});
test("영양정보 미동의는 후보·제품 탐색을 노출하지 않는다",()=>{
  const html=renderToStaticMarkup(<NutritionGuide state={{...state,answers:{...answers,supplementOptIn:false}}} busy={false} onSave={async()=>{}} onEdit={()=>{}}/>);
  assert.ok(!html.includes("다른 영양소·보충 성분 둘러보기"));
});
test("즉흥형과 계획형 모두 한 문항 페이스로 시작하고 상세 컨디션은 선택한다",()=>{
  const props={initial:initialCheckin(defaultAnswers),busy:false,error:"",onSubmit:()=>{},onClose:()=>{},preview:(c:Checkin)=>buildDay(defaultAnswers,c,"core",defaultSchedule)};
  const html=renderToStaticMarkup(<DailyCheckin {...props} style="spontaneous"/>);
  const planned=renderToStaticMarkup(<DailyCheckin {...props} style="planned"/>);
  for(const view of [html,planned]){assert.match(view,/원하는 활동 페이스/);assert.match(view,/자세히 알려주기/);assert.doesNotMatch(view,/CHECK-IN 1 \/ 8/);}
});
