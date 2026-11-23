import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { calculatePet,compactPet,newPetDocument,petBaseState } from "../lib/pet-engine";
import { applyPetCommand,commandAlreadyApplied,protectsPetRecords } from "../lib/pet-actions";
import { createPetHandlers } from "../lib/pet-api";
import { defaultAnswers,defaultSchedule,stateSchema,type AppState } from "../lib/model";
import type { EffectType,PetCommand,PetDocument,PetExecution,PetRequest } from "../lib/pet-model";
import { PetHome } from "../components/pet-companion";
import { buildDay } from "../lib/engine";
import { initialCheckin } from "../lib/model";
import { captureMorning,withMorning,morningAdvice,morningSimilarity } from "../lib/morning-insights";
import { addDate } from "../lib/planner";
import { morningProposals,applyMorningProposal,withMorningFeedback } from "../lib/morning-proposals";
import { plannerSchema,plannerBlockSchema } from "../lib/planner-model";
import { occursOn } from "../lib/planner";
import { morningRecordSchema } from "../lib/morning-model";

const at=new Date("2026-10-30T00:00:00.000Z"),later=(minutes:number)=>new Date(at.getTime()+minutes*60000);
const app=():AppState=>({version:1,consentAt:at.toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"검증용"},schedule:defaultSchedule,days:[],inbody:[]});
const doc=()=>newPetDocument("솜이",randomUUID(),at);
function record(type:EffectType,from:number,to:number,extra:Partial<PetExecution>={}):PetExecution{return {id:randomUUID(),title:type,type,start:later(from).toISOString(),end:later(to).toISOString(),sources:[{kind:"manual",id:randomUUID(),date:"2026-10-30"}],intensity:"moderate",status:"done",cancelled:false,feeling:"same",updatedAt:later(to).toISOString(),...extra};}
const request=(command:PetCommand):PetRequest=>({key:randomUUID(),command,revision:0,appRevision:1});
function command(d:PetDocument,r:PetExecution,now=later(1000)){return applyPetCommand(d,app(),request({action:"record",record:{title:r.title,type:r.type,start:r.start,end:r.end,intensity:r.intensity,fullness:r.fullness,source:r.sources[0],status:r.status}}),now).document;}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);

test("기상 기록은 명시한 컨디션만 저장하고 전날 체감과 수면 미입력을 구분한다",()=>{
  const state=app(),pet=doc();
  const checkin={...initialCheckin(state.answers),reported:true,morning:true,energyKnown:true,energy:2,sleepKnown:false};
  const now=new Date("2026-10-31T08:00:00+09:00");
  pet.records=[record("exercise",0,60,{burden:{planned:{mental:5},actual:{physical:4}}})];
  assert.equal(captureMorning(state,{...checkin,energyKnown:false},pet,now),null);
  const snapshot=captureMorning(state,checkin,pet,now)!;
  assert.equal(snapshot.previousMental,null);
  assert.equal(snapshot.previousPhysical,4);
  assert.equal(snapshot.previousExercise,60);
  assert.equal(snapshot.sleepHours,null);
  morningRecordSchema.parse(snapshot);
  const saved=withMorning(state,snapshot);
  assert.equal(withMorning(saved,snapshot).morningRecords?.length,1);
  assert.equal(morningAdvice(saved.morningRecords!,snapshot.date)?.tired,true);
  assert.equal(morningAdvice(saved.morningRecords!,snapshot.date)?.similarEnergy,null);
});

test("개인 컨디션 범위는 이전 날짜만 참고하며 충분한 실제 기록을 기다린다",()=>{
  const state=app(),now=new Date("2026-10-31T08:00:00+09:00");
  const current=captureMorning(state,{...initialCheckin(state.answers),reported:true,morning:true,energyKnown:true,
    energy:2,sleepKnown:true,sleep:7},null,now)!;
  const history=Array.from({length:7},(_,i)=>({...current,date:addDate(current.date,-i-1),energy:i<3?4:2,previousMental:3,unwell:false}));
  const result=morningAdvice([...history,{...current,previousMental:3}],current.date)!;
  assert.equal(result.patterns.find(row=>row.label==="수면")?.count,3);
  assert.equal(result.similarCount,7);
  assert.equal(morningAdvice([current],current.date)?.patterns.length,0);
  assert.equal(morningAdvice(history,current.date),null);
});

test("포만감은 매분 5씩 감소하고 0 아래로 내려가지 않으며 식사·활동·자정을 반영한다",()=>{
  for(const type of ["none","study","exercise","sleep"] as const){
    const d=doc();d.records=[record(type,0,60)];
    near(calculatePet(d,later(1)).stats.fullness,55);near(calculatePet(d,later(6)).stats.fullness,30);near(calculatePet(d,later(12)).stats.fullness,0);
    d.records.push(record("meal",20,20,{fullness:80}));near(calculatePet(d,later(21)).stats.fullness,75);near(calculatePet(d,later(36)).stats.fullness,0);
  }
  const d=doc();d.records=[record("meal",895,895,{fullness:60})];near(calculatePet(d,later(901)).stats.fullness,30);
});

test("활동 없는 시간의 회복은 하루 6시간으로 제한되어 스트레스와 체력이 포화되지 않는다",()=>{
  const d=doc();d.seed.stats.stamina=105;d.seed.stats.maxStamina=105;d.seed.stats.stress=0;
  d.records=[record("study",0,60)];
  const ended=calculatePet(d,later(60)),idle=calculatePet(d,later(420)),long=calculatePet(d,later(780));
  near(ended.stats.stamina,99);near(ended.stats.stress,10);near(idle.stats.stamina,102);near(idle.stats.stress,9.4);
  near(long.stats.stamina,102);near(long.stats.stress,9.4);
});

test("사모예드는 상태 경계 30/80을 사용하고 가벼운 식사 30은 정상으로 조작하지 않는다",()=>{assert.equal(petBaseState(30,79),"tired");assert.equal(petBaseState(31,80),"tired");assert.equal(petBaseState(31,79),"idle");const d=doc();d.records=[record("meal",10,10,{fullness:30})];const v=calculatePet(d,later(10));assert.equal(v.stats.fullness,30);assert.equal(v.baseState,"tired");near(v.stats.stress,30-10/60*.1-1);});
test("실제 활동과 경과 시간을 구분하여 체력·스트레스·성장을 계산한다",()=>{const d=doc();d.records=[record("exercise",0,30)];const v=calculatePet(d,later(30));near(v.stats.stamina,72);near(v.stats.stress,35);near(v.stats.fullness,0);near(v.stats.fitnessTotalXP,5);const v2=calculatePet(d,later(60));near(v2.stats.stamina,72.25);near(v2.stats.stress,34.95);near(v2.stats.fitnessTotalXP,5);});
test("운동 XP는 한국 날짜마다 30까지, 최대 체력 성장은 현재 체력을 즉시 채우지 않는다",()=>{const d=doc();d.seed.stats.fitnessXP=45;d.records=[record("exercise",0,240)];const v=calculatePet(d,later(240));assert.equal(v.stats.maxStamina,105);assert.equal(v.stats.fitnessXP,25);assert.equal(v.stats.fitnessTotalXP,30);assert.equal(v.stats.stamina,16);assert.equal(v.changes[0].requestedFitnessXP,40);});
test("실제 부담을 우선 적용하고 확인된 항목만 강도를 대체한다",()=>{
  const d=doc();
  d.records=[record("exercise",0,60,{intensity:"high",burden:{planned:{mental:2,physical:5},actual:{physical:3}}})];
  const v=calculatePet(d,later(60));
  near(v.stats.stamina,64);
  near(v.stats.stress,38);
  near(v.stats.fitnessTotalXP,10);
  near(v.stats.fullness,0);
});
test("한국 자정 전후 운동은 서로 다른 하루 상한을 사용한다",()=>{const d=doc();d.records=[record("exercise",600,1080)];const v=calculatePet(d,later(1080));assert.equal(v.stats.fitnessTotalXP,60);});
test("실제 수면 회복은 하루 9시간까지만 적용하며 포만감 감소는 계속된다",()=>{const d=doc();d.seed.stats.stamina=0;d.seed.stats.stress=100;d.records=[record("sleep",0,600)];const v=calculatePet(d,later(600));assert.equal(v.stats.stamina,72);assert.equal(v.stats.stress,64);near(v.stats.fullness,0);});
test("24시간 미기록 이후 자동 변화가 멈추고 새로고침으로 다시 시작하지 않는다",()=>{const d=doc();const a=calculatePet(d,later(1440)),b=calculatePet(d,later(4000));assert.deepEqual(a.stats,b.stats);assert.equal(b.pausedByGap,true);});
test("과거 식사 수정과 운동 취소는 후속 상태와 하루 XP 배분을 재계산한다",()=>{let d=doc();const a=record("exercise",0,240),b=record("exercise",300,360);d.records=[a,b];assert.equal(calculatePet(d,later(360)).stats.fitnessTotalXP,30);d=applyPetCommand(d,app(),request({action:"cancel",id:a.id}),later(360)).document;assert.equal(calculatePet(d,later(360)).stats.fitnessTotalXP,10);});
test("실제 시각 없는 계획은 보상에 반영하지 않고 겹친 수행·미래 수행은 거절한다",()=>{const d=doc();assert.equal(calculatePet(d,at).stats.fitnessTotalXP,0);const r=record("exercise",0,30);const next=command(d,r);assert.throws(()=>command(next,record("study",10,40)),/겹쳐/);assert.throws(()=>command(next,record("study",2000,2030)),/실제 시각/);});
test("같은 요청의 중복 저장과 요청 ID 재사용을 구분한다",()=>{const input=request({action:"adopt",name:"솜이"});const next=applyPetCommand(null,app(),input,at);assert.equal(commandAlreadyApplied(next.document,input),true);assert.throws(()=>commandAlreadyApplied(next.document,{...input,command:{action:"adopt",name:"변경"}}),/요청 ID/);});
test("같은 실제 활동에 출처만 연결하면 XP가 늘지 않는다",()=>{const d=doc(),r=record("study",0,30),next=command(d,r);const result=applyPetCommand(next,app(),request({action:"record",record:{title:"동일",type:"study",start:r.start,end:r.end,intensity:"moderate",status:"done",source:{kind:"manual",id:"second",date:"2026-10-30"},linkTo:next.records[0].id}}),later(30));assert.equal(result.document.records.length,1);assert.equal(result.document.records[0].sources.length,2);assert.equal(calculatePet(result.document,later(30)).stats.learningTotalXP,10);});
test("수면은 실제 취침·기상 시각과 정확히 일치해야 연결한다",()=>{const d=doc(),r=record("sleep",0,60);assert.throws(()=>applyPetCommand(d,app(),request({action:"record",record:{...r,source:{kind:"sleep",id:"session",date:"2026-10-30"}} as never}),later(60)),/실제 시각/);});
test("완료·실제 시간 투영을 기존 전체 상태 PUT이 덮어쓰지 못한다",()=>{const a=app(),day=buildDay(defaultAnswers,initialCheckin(defaultAnswers),"core",defaultSchedule,[],undefined,"2026-10-30");a.days=[day];const r=record("rest",0,30),source={kind:"routine" as const,id:day.routines[0].id,date:day.date};const result=applyPetCommand(doc(),a,request({action:"record",record:{title:r.title,type:r.type,start:r.start,end:r.end,intensity:"moderate",source,status:"done"}}),later(30));assert.equal(result.app.days[0].statuses[source.id],"done");assert.equal(result.app.days[0].activityFeedback?.[source.id]?.actualMinutes,30);assert.equal(stateSchema.safeParse(result.app).success,true,JSON.stringify(stateSchema.safeParse(result.app)));const stale=structuredClone(result.app);delete stale.days[0].statuses[source.id];assert.equal(protectsPetRecords(result.app,stale,result.document),false);});
test("90일 상세 보관을 요약해도 최종 계산 결과는 유지된다",()=>{const d=doc();d.records=[record("study",0,60),record("meal",90,90,{fullness:60})];const now=later(92*1440),expected=calculatePet(d,now),compacted=compactPet(d,now);assert.equal(compacted.records.length,0);assert.equal(compacted.archivedCount,2);assert.deepEqual(calculatePet(compacted,now).stats,expected.stats);});
test("이름·보이기·동작 설정 변경은 성장 기록을 초기화하지 않는다",()=>{const d=doc();d.records=[record("growth",0,30)];const out=applyPetCommand(d,app(),request({action:"settings",name:"눈송이",visible:false,reducedMotion:true}),later(30));assert.equal(out.document.records.length,1);assert.equal(calculatePet(out.document,later(30)).stats.learningTotalXP,8);});
test("인증·출처·입력 검증을 통과하기 전 저장소에 접근하지 않는다",async()=>{let calls=0;const repo={get:async()=>{calls++;return {document:null,view:null,revision:0,appRevision:1};},mutate:async()=>{calls++;return {document:null,view:null,revision:0,appRevision:1};}};const anonymous=createPetHandlers(async()=>null,repo);assert.equal((await anonymous.GET()).status,401);const h=createPetHandlers(async()=>"user",repo),url="https://routine.test/api/pet";assert.equal((await h.POST(new Request(url,{method:"POST",headers:{Origin:"https://bad.test"},body:"{}"}))).status,403);assert.equal((await h.POST(new Request(url,{method:"POST",headers:{Origin:"https://routine.test"},body:"{}"}))).status,400);assert.equal(calls,0);});
test("초기 화면에서 빨간 스카프 사모예드를 발견하고 선택할 수 있다",()=>{const html=renderToStaticMarkup(<PetHome pet={null} busy={false} error="" loading={false} onCommand={async()=>{}} onRecord={()=>{}} onCheckin={()=>{}} onSettings={()=>{}}/>);assert.match(html,/사모예드와 함께 시작/);assert.match(html,/poster-idle.png/);assert.match(html,/빨간 스카프/);});

const morningNow=new Date("2026-10-31T08:00:00+09:00");
const morningRow=()=>captureMorning(app(),{...initialCheckin(defaultAnswers),reported:true,morning:true,energyKnown:true,energy:2,sleepKnown:true,sleep:6},null,morningNow)!;
const flexible=(extra:Record<string,unknown>={})=>plannerBlockSchema.parse({id:"flex",title:"선택 과제",category:"task",location:"",task:"",start:"18:00",end:"19:00",mental:4,physical:1,shade:1,kind:"once",date:"2026-10-31",weekdays:[],adjustability:"adjustable",...extra});

test("취침 직전 24시간의 실제 부담·야간 시간은 축별로 계산하고 수면 회복 이후와 구분한다",()=>{
  const state=app(),pet=doc();
  pet.records=[record("study",780,840,{burden:{actual:{mental:5}}}),record("exercise",840,900,{burden:{actual:{physical:4}}}),record("sleep",900,1320),record("sleep",1360,1370)];
  const r=captureMorning(state,{...initialCheckin(defaultAnswers),reported:true,morning:true,energyKnown:true,energy:4,sleepKnown:false},pet,morningNow)!;
  assert.equal(r.snapshotBasis,"sleep");assert.equal(r.snapshotAt,later(900).toISOString());assert.equal(r.sleepHours,7);
  near(r.petStamina!,calculatePet(pet,later(900)).stats.stamina);
  assert.equal(r.previousMental,5);assert.equal(r.previousPhysical,4);
  assert.equal(r.highMentalMinutes,60);assert.equal(r.highPhysicalMinutes,60);assert.equal(r.lateMinutes,120);
  assert.equal(r.previousActivityMinutes,120);morningRecordSchema.parse(r);
});

test("비슷한 날의 분포는 이전 14일·유사한 5일이 필요하고 수면만 있는 날은 비교하지 않는다",()=>{
  const row={...morningRow(),previousMental:3};
  const history=Array.from({length:14},(_,i)=>({...row,date:addDate(row.date,-i-1),energy:i<5?4:i<10?3:2}));
  assert.equal(morningAdvice([...history.slice(0,13),row],row.date)?.distribution,null);
  const result=morningAdvice([...history,row],row.date)!;
  assert.deepEqual(result.distribution,{good:5,normal:5,tired:4});assert.equal(result.similarCount,14);
  assert.equal(morningSimilarity({...row,previousMental:null}, {...row,previousMental:null}),null);
  assert.equal(morningSimilarity({...row,sleepHours:null},row),null);
  assert.equal(morningSimilarity(row,row),1);
  assert.equal(morningAdvice([...history,{...row,date:addDate(row.date,1),energy:5},row],row.date)?.similarCount,14);
});

test("오늘 제안은 고정·지난 일정·실행한 일정을 보존하고 반복 일정 한 번만 줄인다",()=>{
  const state=app();state.planner=plannerSchema.parse({setupComplete:true,templates:[],blocks:[flexible({id:"fixed",adjustability:"fixed"}),flexible({id:"past",start:"06:00",end:"07:00"}),flexible({id:"done"}),flexible({id:"repeat",kind:"fixed",date:"2026-10-24",weekdays:[6]})],records:[{blockId:"done",date:"2026-10-31",status:"done",title:"끝",start:"18:00",end:"19:00",recordedAt:morningNow.toISOString()}]});
  const row=morningRow(),p=morningProposals(state,row,morningNow);
  assert.deepEqual(p.filter(p=>p.blockId).map(p=>p.blockId),["repeat"]);
  const proposal=p.find(p=>p.blockId)!;const next=applyMorningProposal(state.planner,proposal,row.date,morningNow);
  const repeat=next.blocks.find(b=>b.id==="repeat")!;
  assert.equal(occursOn(repeat,row.date),false);assert.equal(occursOn(repeat,addDate(row.date,7)),true);
  assert.equal(next.blocks.find(b=>b.id!=="repeat"&&b.kind==="once"&&b.date===row.date&&b.end==="18:30")?.title,"선택 과제");
  assert.equal(next.blocks.find(b=>b.id==="fixed")?.end,"19:00");
  assert.throws(()=>applyMorningProposal(next,proposal,row.date,morningNow));
  assert.equal(state.planner.blocks.find(b=>b.id==="repeat")?.excludedDates.length,0);
});

test("내일 이동은 마감·중요 할 일·겹친 시간과 반복 날짜를 보호하고 미리보기 이후 다시 검사한다",()=>{
  const state=app(),row=morningRow(),b=flexible({adjustability:"movable"});state.planner=plannerSchema.parse({setupComplete:true,templates:[],blocks:[b]});
  const p=morningProposals(state,row,morningNow).find(p=>p.blockId)!;assert.equal(p.targetDate,"2026-11-01");
  const next=applyMorningProposal(state.planner,p,row.date,morningNow);assert.equal(next.blocks[0].date,"2026-11-01");
  const occupied={...state.planner,blocks:[b,flexible({id:"tomorrow",date:"2026-11-01"})]};
  assert.throws(()=>applyMorningProposal(occupied,p,row.date,morningNow),/다른 일정/);
  assert.equal(morningProposals({...state,planner:occupied},row,morningNow).some(p=>p.blockId),false);
  const deadline=plannerSchema.parse({...state.planner,blocks:[{...b,todoId:"deadline"}],todos:[{id:"deadline",title:"오늘 마감",dueDate:row.date}]});
  assert.equal(morningProposals({...state,planner:deadline},row,morningNow).some(p=>p.blockId),false);
  assert.throws(()=>applyMorningProposal({...state.planner!,blocks:[{...b,adjustability:"fixed"}]},p,row.date,morningNow));
});

test("제안 피드백은 계정 상태에서 왕복하며 한 날짜 중복 반영·넘긴 제안 재노출을 막는다",()=>{
  const row={...morningRow(),previousMental:5},state=withMorning(app(),row),p=morningProposals(state,row,morningNow)[0];
  const saved=withMorningFeedback(state,{date:row.date,id:p.id,kind:p.kind,action:"dismissed",at:morningNow.toISOString()});
  const round=stateSchema.parse(JSON.parse(JSON.stringify(saved)));
  assert.equal(round.morningFeedback?.length,1);
  assert.equal(morningProposals(round,row,morningNow).some(x=>x.id===p.id),false);
  assert.equal(withMorningFeedback(saved,saved.morningFeedback![0]).morningFeedback?.length,1);
});

 test("할 일 수행은 부담을 반영하고 완료·취소를 동기화하며 연결 일정과 중복 성장하지 않는다",()=>{
  const state=app();state.planner=plannerSchema.parse({setupComplete:true,blocks:[],templates:[],todos:[{id:"todo",title:"과제",todayDate:"2026-10-30",category:"task",mental:5,physical:4}]});
  const r=record("study",0,30);const input={title:"과제",type:"study" as const,start:r.start,end:r.end,intensity:"moderate" as const,status:"done" as const,source:{kind:"todo" as const,id:"todo",date:"2026-10-30"}};
  const saved=applyPetCommand(doc(),state,request({action:"record",record:input}),later(30));
  assert.equal(saved.app.planner?.todos?.[0].status,"done");near(calculatePet(saved.document,later(30)).stats.stress,37);near(calculatePet(saved.document,later(30)).stats.stamina,76.4);
  const cancelled=applyPetCommand(saved.document,saved.app,request({action:"cancel",id:saved.document.records[0].id}),later(30));assert.equal(cancelled.app.planner?.todos?.[0].status,"open");near(calculatePet(cancelled.document,later(30)).stats.stress,29.95);
  state.planner!.blocks=[plannerBlockSchema.parse({id:"linked",title:"연결 과제",category:"task",kind:"once",date:"2026-10-30",start:"09:00",end:"09:30",weekdays:[],todoId:"todo",location:"",task:"",mental:3,physical:3,shade:1})];
  const linked=applyPetCommand(doc(),state,request({action:"record",record:input}),later(30));assert.equal(linked.document.records.length,1);assert.equal(linked.document.records[0].sources.length,2);assert.equal(linked.app.planner?.records?.[0].status,"done");near(calculatePet(linked.document,later(30)).stats.learningTotalXP,10);

 });
