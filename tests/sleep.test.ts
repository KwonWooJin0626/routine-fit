import test from "node:test";
import assert from "node:assert/strict";
import { createSleepHandlers,type SleepIdentity,type SleepProfile,type SleepRepository } from "../lib/sleep-api";
import { defaultSleepSettings,dueSleepEvents,sleepSessionDate,plannedSleepTime,type SleepRecord } from "../lib/sleep";
import { signSleepToken,readSleepToken } from "../lib/sleep-token";

const now=new Date("2026-10-26T22:05:00.000Z"),origin="https://routine.test";
const request=(method:string,body:unknown,site=origin)=>new Request(`${origin}/api/sleep`,{method,headers:{Origin:site,"Content-Type":"application/json"},body:JSON.stringify(body)});
function setup(){
  let user:SleepIdentity|null={userId:"user-a",email:"synthetic@example.test",verified:true};
  const profiles=new Map<string,SleepProfile>(),records=new Map<string,SleepRecord[]>();
  const repo:SleepRepository={
    async get(id){return {profile:profiles.get(id)??null,records:records.get(id)??[]};},
    async settings(id,email,settings,revision){const old=profiles.get(id);if((old?.revision??0)!==revision)return null;const value={settings,email,revision:revision+1};profiles.set(id,value);return value;},
    async checkin(id,value){const rows=records.get(id)??[],old=rows.find(r=>r.id===value.id);if(old)return old;records.set(id,[...rows,value]);return value;},
    async correct(id,key,actualAt,updatedAt){const old=(records.get(id)??[]).find(r=>r.id===key);if(!old)return null;const next={...old,actualAt,updatedAt};records.set(id,records.get(id)!.map(r=>r.id===key?next:r));return next;},
    async emailCheckin(){return null;},
  };
  const handlers=createSleepHandlers(async()=>user,repo,()=>({mailConfigured:false,schedulerConfigured:false}),()=>now);
  return {handlers,profiles,records,login:(next:SleepIdentity|null)=>{user=next;}};
}
test("수면 날짜는 한국 시간·기상일을 기준으로 밤샘과 전날 취침을 구분한다",()=>{
  const s=defaultSleepSettings();assert.equal(sleepSessionDate("wake",now,s),"2026-10-27");
  assert.equal(sleepSessionDate("bed",new Date("2026-10-26T14:00:00Z"),s),"2026-10-27");
  assert.equal(plannedSleepTime("2026-10-27","bed",s),"2026-10-26T14:00:00.000Z");
  const shift=defaultSleepSettings("08:00","16:00");assert.equal(plannedSleepTime("2026-10-27","bed",shift),"2026-10-26T23:00:00.000Z");
});
test("메일 예약은 선택한 기상 요일·10분 유효 구간만 사용하며 중지한 사용자는 발송하지 않는다",()=>{
  const s={...defaultSleepSettings(),emailEnabled:true,weekdays:[2]};
  assert.equal(dueSleepEvents(s,now).length,1);assert.equal(dueSleepEvents(s,now)[0].kind,"wake");
  assert.equal(dueSleepEvents(s,new Date(now.getTime()+20*60000)).length,0);
  assert.equal(dueSleepEvents({...s,emailEnabled:false},now).length,0);
  assert.equal(dueSleepEvents({...s,weekdays:[1]},now).length,0);
});
test("GET과 목표 저장만으로 체크인이 생성되지 않고 설정 없는 직접 체크인은 거절한다",async()=>{
  const s=setup();assert.equal((await s.handlers.GET()).status,200);assert.equal(s.records.size,0);
  assert.equal((await s.handlers.POST(request("POST",{kind:"wake"}))).status,400);
  assert.equal((await s.handlers.PUT(request("PUT",{settings:defaultSleepSettings(),revision:0}))).status,200);assert.equal(s.records.size,0);
  assert.equal((await s.handlers.PUT(request("PUT",{settings:defaultSleepSettings(),revision:0}))).status,409);
});
test("메일 미설정 상태에서는 웹 체크인만 사용하고 최초 확인·실제 시각을 별도 저장한다",async()=>{
  const s=setup();assert.equal((await s.handlers.PUT(request("PUT",{settings:{...defaultSleepSettings(),emailEnabled:true},revision:0}))).status,400);
  await s.handlers.PUT(request("PUT",{settings:defaultSleepSettings(),revision:0}));
  const first=await (await s.handlers.POST(request("POST",{kind:"wake"}))).json();
  assert.equal(first.record.checkedAt,now.toISOString());assert.equal(first.record.actualAt,null);
  const again=await (await s.handlers.POST(request("POST",{kind:"wake"}))).json();assert.deepEqual(again.record,first.record);assert.equal(s.records.get("user-a")?.length,1);
  const actualAt=new Date(now.getTime()-15*60000).toISOString(),changed=await (await s.handlers.PATCH(request("PATCH",{id:first.record.id,actualAt}))).json();
  assert.equal(changed.record.actualAt,actualAt);assert.equal(changed.record.checkedAt,now.toISOString());
  assert.equal((await s.handlers.PATCH(request("PATCH",{id:first.record.id,actualAt:new Date(now.getTime()+60000).toISOString()}))).status,400);
});
test("다른 계정·외부 출처·무인증 요청으로 수면 기록을 수정할 수 없다",async()=>{
  const s=setup();await s.handlers.PUT(request("PUT",{settings:defaultSleepSettings(),revision:0}));const old=await (await s.handlers.POST(request("POST",{kind:"wake"}))).json();
  assert.equal((await s.handlers.POST(request("POST",{kind:"wake"},"https://evil.test"))).status,403);
  s.login({userId:"user-b",email:"other@example.test",verified:true});assert.equal((await s.handlers.PATCH(request("PATCH",{id:old.record.id,actualAt:null}))).status,404);
  assert.equal((await s.handlers.POST(request("POST",{kind:"wake",token:"a".repeat(50)}))).status,400);
  s.login(null);assert.equal((await s.handlers.GET()).status,401);assert.equal((await s.handlers.POST(request("POST",{kind:"wake"}))).status,401);
});
test("서명된 메일 링크는 변조·만료를 거절하고 계정·날짜·설정 버전을 포함한다",()=>{
  const secret="synthetic-test-secret-not-production",claim={userId:"user-a",deliveryId:"delivery-a",revision:2,sessionDate:"2026-10-27",kind:"wake" as const,expires:now.getTime()+60000};
  const token=signSleepToken(claim,secret);assert.deepEqual(readSleepToken(token,secret,now.getTime()),claim);
  assert.equal(readSleepToken(token+"x",secret,now.getTime()),null);assert.equal(readSleepToken(token,secret,now.getTime()+120000),null);assert.equal(readSleepToken(token,"other-secret",now.getTime()),null);
});
