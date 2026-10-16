import test from "node:test";
import assert from "node:assert/strict";
import { analyze, buildRoutines, buildDay, buildTimeline, extractInbody, supplementGuides, validateSchedule, reviseDayRoutines } from "../lib/engine";
import { getRoutineCatalog, MAX_DAILY_ROUTINES } from "../lib/routine-catalog";
import { guidanceForRoutine, routineSearchText } from "../lib/routine-guidance";
import { routineSchema } from "../lib/model";
import { activityComparison } from "../lib/lifestyle-analysis";
import { evidence, questionEvidence, routineEvidence } from "../lib/evidence";
import { answersSchema, defaultAnswers, defaultSchedule, inbodySchema, initialCheckin, localDate, stateSchema, toMinutes } from "../lib/model";

const a = {...defaultAnswers,name:"테스트",vegetables:2,fish:0,dairy:0};
const checkin = initialCheckin(a);
test("기존 안전정보 미확인 상태는 구매 연결을 보류하고 명시 확인 후에만 해제한다",()=>{
  assert.ok(supplementGuides(a).every(g=>g.blocked));
  assert.ok(supplementGuides({...a,safetyReviewed:true}).some(g=>!g.blocked));
  assert.ok(supplementGuides({...a,safetyReviewed:true,medicines:true}).every(g=>g.blocked));
});
test("보류는 출처와 이전 실천 상태에 관계없이 적용하고 기록을 보존한다",()=>{
  for(const source of ["auto","catalog","custom"] as const) for(const status of [undefined,"partial","skipped","done"] as const) for(const movementLimit of [false,true]) {
    const walk={...getRoutineCatalog(a,checkin).find(r=>r.id==="move-break")!,source};
    const previous={...buildDay(a,checkin,"full",defaultSchedule),routines:[walk],statuses:status?{[walk.id]:status}:{}};
    const next=buildDay({...a,movementLimit},{...checkin,unwell:!movementLimit},"full",defaultSchedule,[previous],undefined,previous.date,false);
    assert.equal(next.routines[0].held,true);assert.equal(next.statuses[walk.id],status);
    assert.ok(!next.timeline.some(t=>t.routineId===walk.id));
    assert.ok(next.warnings.some(w=>w.includes("보류")));
    const recovered=buildDay(a,checkin,"core",defaultSchedule,[next],undefined,next.date,false);
    assert.ok(!recovered.routines[0].held);assert.equal(recovered.statuses[walk.id],status);
  }
});
test("식사 가능한 휴식을 등록하면 점심과 출근을 제시간에 보호한다",()=>{
  const schedule={...defaultSchedule,events:[{id:"work",title:"업무",start:"09:00",end:"18:00",breakStart:"12:00",breakEnd:"13:30"}]};
  const plan=buildTimeline([],schedule);
  assert.equal(plan.timeline.find(t=>t.id==="lunch")?.start,"12:30");
  assert.equal(plan.timeline.find(t=>t.id==="outbound")?.start,"08:20");
  assert.deepEqual(plan.warnings,[]);
  const blocked=buildTimeline([],{...schedule,events:[{id:"work",title:"업무",start:"09:00",end:"18:00"}]});
  assert.ok(!blocked.timeline.some(t=>t.id==="lunch"));assert.ok(blocked.warnings.some(w=>w.includes("점심식사")));
});
test("야간 일정과 자정 이후 휴식도 겹치지 않게 배치한다",()=>{
  const schedule={...defaultSchedule,wake:"16:00",bed:"09:00",breakfast:"17:00",lunch:"01:00",dinner:"08:00",preparation:20,events:[{id:"night",title:"야간근무",start:"22:00",end:"07:00",breakStart:"00:30",breakEnd:"01:50"}]};
  assert.deepEqual(validateSchedule(schedule),[]);
  const plan=buildTimeline([],schedule);assert.deepEqual(plan.warnings,[]);
  assert.equal(plan.timeline.find(t=>t.id==="lunch")?.start,"01:00");
  assert.ok(validateSchedule({...schedule,events:[...schedule.events,{id:"overlap",title:"중복",start:"02:00",end:"03:00"}]}).some(w=>w.includes("겹쳐")));
});
test("스트레스 목표는 바쁜 날에도 마음 루틴을 포함하고 활동 충분 시 추가 걷기를 우선하지 않는다",()=>{
  const stress=buildRoutines({...a,goal:"stress"},{...checkin,busy:true,minutes:5});
  assert.equal(stress[0].category,"mind");assert.ok(stress.reduce((n,r)=>n+r.minutes,0)<=5);
  const active=buildRoutines({...a,moderateWeeklyMinutes:400,vigorousWeeklyMinutes:0},checkin);
  assert.ok(active.some(r=>["move-stretch","move-posture","move-desk"].includes(r.id)));assert.ok(!active.some(r=>r.id==="move-break"));
  assert.equal(buildRoutines({...a,skip:"dinner"},checkin).find(r=>r.id==="food-first")?.when,"저녁 식사 전");
});
test("질문 응답을 변경하면 분석 결과가 달라진다",()=>{
  assert.equal(analyze({...a,sleepHours:8})[0].metrics[0].status,"met");
  assert.equal(analyze({...a,sleepHours:4})[0].metrics[0].status,"below");
  assert.equal(analyze({...a,moderateWeeklyMinutes:150,vigorousWeeklyMinutes:0})[2].metrics[0].status,"met");
  assert.equal(analyze({...a,moderateWeeklyMinutes:149,vigorousWeeklyMinutes:0})[2].metrics[0].status,"below");
});

test("독립된 지표를 사용하고 자체 100점 건강점수를 만들지 않는다",()=>{
  for(const row of analyze(a))assert.ok(!("score" in row));
  const low=analyze({...a,stress:5,energy:1})[3],high=analyze({...a,stress:5,energy:5})[3];
  assert.deepEqual(low.metrics[0],high.metrics[0]);assert.notEqual(low.metrics[1].value,high.metrics[1].value);
  assert.ok(low.metrics.every(m=>m.status==="self"));assert.ok(low.limitation.includes("PSS-10"));
});

test("강도별 활동은 합산하되 가벼운 운동과 미입력은 임의 환산하지 않는다",()=>{
  assert.equal(activityComparison({...a,moderateWeeklyMinutes:60,vigorousWeeklyMinutes:45}).equivalent,150);
  assert.equal(activityComparison({...a,moderateWeeklyMinutes:0,vigorousWeeklyMinutes:75}).equivalent,150);
  assert.equal(activityComparison({...a,exerciseIntensity:"light",exerciseDays:7,exerciseMinutes:180}).equivalent,null);
  assert.equal(analyze({...a,moderateWeeklyMinutes:0,vigorousWeeklyMinutes:null})[2].metrics[0].status,"unknown");
  assert.equal(analyze({...a,moderateWeeklyMinutes:0,vigorousWeeklyMinutes:0})[2].metrics[0].status,"below");
  assert.equal(analyze({...a,strengthDays:2,strengthAllGroups:"yes"})[2].metrics[2].status,"met");
  assert.equal(analyze({...a,strengthDays:2,strengthAllGroups:"unknown"})[2].metrics[2].status,"unknown");
});

test("섭취량 400g 경계를 비교하고 빈칸은 영양소 부족으로 판단하지 않는다",()=>{
  assert.equal(analyze({...a,fruitVegGrams:400})[1].metrics[0].status,"met");
  assert.equal(analyze({...a,fruitVegGrams:399})[1].metrics[0].status,"below");
  assert.equal(analyze({...a,fruitVegGrams:0})[1].metrics[0].status,"below");
  assert.equal(analyze({...a,fruitVegGrams:null})[1].metrics[0].status,"unknown");
  assert.equal(analyze({...a,vegetables:7,fruit:7})[1].metrics[0].status,"unknown");
  assert.ok(analyze(a)[1].limitation.includes("공식 NQ-2021"));
});

test("연령·교대근무·개별 식이 및 운동 제한을 기준 해석에 우선한다",()=>{
  assert.ok(analyze({...a,age:"65+"})[0].metrics[0].reference.includes("7–8"));
  assert.ok(analyze({...a,age:"50-64"})[0].limitation.includes("최소시간"));
  assert.equal(analyze({...a,work:"shift",scheduleShiftHours:0})[0].metrics[1].status,"individual");
  assert.equal(analyze({...a,conditions:true,fruitVegGrams:500,moderateWeeklyMinutes:150,vigorousWeeklyMinutes:0})[1].metrics[0].status,"individual");
  assert.equal(analyze({...a,movementLimit:true,moderateWeeklyMinutes:150,vigorousWeeklyMinutes:0})[2].metrics[0].status,"individual");
  assert.equal(analyze({...a,diet:"restricted",fruitVegGrams:500})[1].metrics[0].status,"individual");
});

test("기존 데이터는 보존하고 새 질문의 빈칸이나 의미를 임의 변환하지 않는다",()=>{
  assert.ok(answersSchema.safeParse(a).success);
  assert.equal(analyze(a)[0].metrics[1].status,"unknown");
  assert.equal(analyze(a)[2].metrics[0].status,"unknown");
  assert.ok(answersSchema.safeParse({...a,fruitVegGrams:null,moderateWeeklyMinutes:null,vigorousWeeklyMinutes:0}).success);
  assert.ok(!answersSchema.safeParse({...a,moderateWeeklyMinutes:-1}).success);
  assert.ok(!answersSchema.safeParse({...a,fruitVegGrams:2001}).success);
});

test("질문·루틴 자료는 HTTPS 제목 링크이며 자체 질문과 사용자 루틴을 구분한다",()=>{
  for(const source of Object.values(evidence)){assert.ok(source.title);assert.ok(source.url.startsWith("https://"));}
  assert.ok(questionEvidence("sleepHours").ids.includes("sleep"));
  assert.ok(questionEvidence("stress").note.includes("PSS"));
  assert.equal(questionEvidence("name").ids.length,0);
  for(const r of getRoutineCatalog(a,checkin))for(const id of routineEvidence(r).ids)assert.ok(evidence[id]);
  assert.equal(routineEvidence({id:"custom-a",category:"sleep",source:"custom"}).ids.length,0);
  assert.ok(routineEvidence({id:"sleep-music",category:"sleep"}).note.includes("치료 효과"));
  assert.ok(routineEvidence({id:"mind-read",category:"mind"}).note.includes("자체 제안"));
});
test("핵심 루틴은 3~5개이며 오늘의 시간 예산을 넘지 않는다",()=>{
  for(const minutes of [5,10,15,20,30,60]) {
    const rows=buildRoutines({...a,skip:"breakfast"},{...checkin,minutes,stress:4});
    assert.ok(rows.length>=3&&rows.length<=5);
    assert.ok(rows.reduce((n,r)=>n+r.minutes,0)<=minutes);
  }
});
test("몸이 불편하거나 운동 제한이 있으면 활동 대신 회복을 제안한다",()=>{
  for(const rows of [buildRoutines(a,{...checkin,unwell:true}),buildRoutines({...a,movementLimit:true},checkin)]) {
    assert.ok(rows.some(r=>r.id==="move-recovery"));assert.ok(!rows.some(r=>r.id==="move-break"));
  }
});
test("최근 미실천이 많으면 다음 루틴 수와 활동시간을 줄인다",()=>{
  const past=buildDay(a,{...checkin,stress:5},"core",defaultSchedule,[],undefined,"2026-10-01");
  past.statuses=Object.fromEntries(past.routines.map(r=>[r.id,"skipped"]));
  const next=buildRoutines(a,{...checkin,energy:5,sleep:8,minutes:30,stress:5},[past]);
  assert.equal(next.length,3);assert.ok(next.find(r=>r.category==="move")!.minutes<=5);
});
test("질환·복약·임신·수술·알레르기·안전 미확인 응답은 제품 연결을 제한한다",()=>{
  for(const key of ["conditions","medicines","pregnancy","surgery","allergy","uncertainSafety"] as const) {
    assert.ok(supplementGuides({...a,[key]:true}).every(g=>g.blocked));
  }
  assert.ok(supplementGuides({...a,currentSupplements:"종합비타민"}).every(g=>g.blocked));
  assert.ok(supplementGuides({...a,confirmedDeficiency:"검사 결과"}).every(g=>g.blocked));
  assert.deepEqual(supplementGuides({...a,supplementOptIn:false}),[]);
});
test("일정 충돌과 역전된 고정 일정을 거부한다",()=>{
  assert.ok(validateSchedule({...defaultSchedule,events:[{id:"a",title:"수업",start:"09:00",end:"12:00"},{id:"b",title:"회의",start:"11:30",end:"13:00"}]}).length);
  assert.ok(validateSchedule({...defaultSchedule,events:[{id:"a",title:"회의",start:"13:00",end:"11:00"}]}).length);
});
test("고정 일정을 보존하고 모든 생성 일정을 겹치지 않게 배치한다",()=>{
  const schedule={...defaultSchedule,events:[{id:"fixed",title:"업무",start:"09:00",end:"18:00"}]};
  const result=buildTimeline(buildRoutines(a,checkin),schedule);
  assert.equal(result.timeline.find(t=>t.id==="fixed")?.start,"09:00");
  assert.equal(result.timeline.find(t=>t.id==="fixed")?.end,"18:00");
  const rows=result.timeline;
  for(let i=1;i<rows.length;i++)assert.ok(toMinutes(rows[i-1].end)<=toMinutes(rows[i].start),`${rows[i-1].title} vs ${rows[i].title}`);
});
test("바쁜 일정에서 배치할 수 없는 행동은 경고하고 중복 생성하지 않는다",()=>{
  const result=buildTimeline(buildRoutines(a,checkin),{...defaultSchedule,wake:"07:00",bed:"23:00",events:[{id:"all",title:"종일 일정",start:"07:00",end:"23:00"}]});
  assert.equal(result.timeline.length,1);assert.ok(result.warnings.length>=3);
});
test("산책은 배치된 식사 이후, 카페인 행동은 취침 6시간 전에 배치한다",()=>{
  const schedule={...defaultSchedule,events:[{id:"class",title:"수업",start:"13:00",end:"16:00"}]};
  const result=buildTimeline(buildRoutines({...a,caffeineTime:"16:00"},{...checkin,minutes:20}),schedule);
  const lunch=result.timeline.find(t=>t.id==="lunch")!;
  const move=result.timeline.find(t=>t.routineId==="move-break")!;
  const caffeine=result.timeline.find(t=>t.routineId==="sleep-caffeine")!;
  assert.ok(toMinutes(move.start)>=toMinutes(lunch.end));
  assert.ok(toMinutes(caffeine.end)<=toMinutes(schedule.bed)-360);
});
test("InBody OCR은 알려진 필드만 추출하고 범위 밖 수치를 버린다",()=>{
  assert.deepEqual(extractInbody("2026.10.01 신장 170.0 체중 65.2 골격근량 28.5 체지방률 23.5 기초대사량 1450"),{measuredAt:"2026-10-01",height:170,weight:65.2,muscle:28.5,fat:23.5,bmr:1450});
  assert.equal(extractInbody("체중 900.0").weight,undefined);
  assert.equal(inbodySchema.safeParse({measuredAt:"2026-10-01",height:170,weight:50,muscle:60,fat:20}).success,false);
});
test("한국 날짜 경계를 올바르게 처리한다",()=>{
  assert.equal(localDate(new Date("2026-10-11T15:00:00Z")),"2026-10-12");
  assert.equal(localDate(new Date("2026-10-11T14:59:59Z")),"2026-10-11");
});
test("완성된 상태 데이터가 저장 스키마를 통과한다",()=>{
  assert.ok(answersSchema.safeParse(a).success);
  const day=buildDay(a,checkin,"full",defaultSchedule);
  assert.ok(stateSchema.safeParse({version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[day]}).success);
});

test("체크인을 저장할 때마다 미완료 자동 추천 구성이 바뀐다",()=>{
  let day=buildDay(a,checkin,"core",defaultSchedule);
  for(let i=0;i<8;i++){
    const next=buildDay(a,{...checkin,energy:i%2?3:4},"core",defaultSchedule,[day]);
    assert.notDeepEqual(next.routines.map(r=>r.title),day.routines.map(r=>r.title));
    assert.equal(next.generation,(day.generation??0)+1);day=next;
  }
});

test("시간·피로·수면·장소·스트레스·불편 응답을 추천에 반영한다",()=>{
  const normal=buildRoutines(a,{...checkin,minutes:30,sleep:8,energy:5});
  assert.equal(buildRoutines(a,{...checkin,busy:true}).length,3);
  assert.equal(buildRoutines(a,{...checkin,sleep:4}).length,3);
  assert.equal(buildRoutines(a,{...checkin,energy:1}).length,3);
  assert.ok(buildRoutines(a,{...checkin,place:"office"}).some(r=>r.title.includes("회사·학교")));
  const stressed=buildRoutines(a,{...checkin,stress:5},[],undefined,1);
  assert.ok(stressed.some(r=>r.id==="mind-note"));
  assert.ok(normal.find(r=>r.category==="move")!.minutes>buildRoutines(a,{...checkin,minutes:5})[2].minutes);
});

test("시간 예산과 안전 제한은 모든 순환 후보에서도 유지한다",()=>{
  for(const minutes of [5,10,15,20,30,60])for(let g=0;g<12;g++)for(const unwell of [true,false]){
    const rows=buildRoutines(a,{...checkin,minutes,unwell,energy:5,sleep:8},[],undefined,g);
    assert.ok(rows.length>=3&&rows.length<=5);
    assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
    assert.ok(rows.reduce((n,r)=>n+r.minutes,0)<=minutes);
    if(unwell)assert.ok(rows.filter(r=>r.category==="move").every(r=>["move-recovery","move-rest"].includes(r.id)));
  }
});

test("추천 목록은 다양하며 몸이 불편하면 실제 활동을 제외한다",()=>{
  const rows=getRoutineCatalog(a,checkin);assert.ok(rows.length>=24);
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  for(const category of ["sleep","food","move","mind"])assert.ok(rows.filter(r=>r.category===category).length>=4);
  for(const rows of [getRoutineCatalog(a,{...checkin,unwell:true}),getRoutineCatalog({...a,movementLimit:true},checkin)])assert.ok(rows.filter(r=>r.category==="move").every(r=>["move-recovery","move-rest"].includes(r.id)));
});

test("직접 만든·골라 담은·실천 기록이 있는 루틴은 체크인 후에도 유지한다",()=>{
  const day=buildDay(a,checkin,"core",defaultSchedule);
  const custom={...day.routines[0],id:"custom-test",title:"나만의 휴식",source:"custom" as const};
  const selected={...getRoutineCatalog(a,checkin).find(r=>r.id==="mind-music")!,source:"catalog" as const};
  day.routines.push(custom,selected);day.statuses[day.routines[0].id]="done";day.notes[day.routines[0].id]="기록 유지";
  const next=buildDay(a,{...checkin,energy:1,unwell:true},"core",defaultSchedule,[day]);
  assert.deepEqual(next.routines.find(r=>r.id===custom.id),custom);
  assert.deepEqual(next.routines.find(r=>r.id===selected.id),selected);
  assert.equal(next.statuses[day.routines[0].id],"done");assert.equal(next.notes[day.routines[0].id],"기록 유지");
  assert.equal(new Set(next.routines.map(r=>r.id)).size,next.routines.length);
});

test("루틴 추가·제외 시 전체 계획을 재배치하고 상태를 일관되게 유지한다",()=>{
  const day=buildDay(a,checkin,"full",defaultSchedule);
  const custom={...day.routines[0],id:"custom-test",title:"나만의 휴식",category:"mind" as const,preferredTime:"16:00",source:"custom" as const,minutes:5};
  const added=reviseDayRoutines(day,[...day.routines,custom],defaultSchedule);
  assert.equal(added.timeline.find(t=>t.routineId===custom.id)?.start,"16:00");
  added.statuses[custom.id]="done";
  const removed=reviseDayRoutines(added,added.routines.filter(r=>r.id!==custom.id),defaultSchedule);
  assert.ok(!removed.timeline.some(t=>t.routineId===custom.id));assert.equal(removed.statuses[custom.id],undefined);
  const scheduled=buildDay(a,added.checkin,"full",defaultSchedule,[added],undefined,added.date,false);
  assert.deepEqual(scheduled.routines,added.routines);assert.equal(scheduled.generation,added.generation);
});

test("중복·20개 초과를 막고 가용시간 초과를 안내한다",()=>{
  const day=buildDay(a,checkin,"core",defaultSchedule);
  assert.throws(()=>reviseDayRoutines(day,[day.routines[0],day.routines[0]],defaultSchedule),/이미/);
  assert.throws(()=>reviseDayRoutines(day,Array.from({length:MAX_DAILY_ROUTINES+1},(_,i)=>({...day.routines[0],id:`custom-${i}`})),defaultSchedule),/최대/);
  assert.ok(reviseDayRoutines(day,[{...day.routines[0],minutes:120}],defaultSchedule).warnings.some(w=>w.includes("선택한")));
});

test("새 필드가 없는 기존 저장 데이터도 읽을 수 있다",()=>{
  const day=buildDay(a,checkin,"core",defaultSchedule);delete day.generation;day.routines.forEach(r=>delete r.source);
  assert.ok(stateSchema.safeParse({version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[day]}).success);
});

test("네 카테고리마다 독서·음악 후보와 분야·장르 안내를 제공한다",()=>{
  const rows=getRoutineCatalog(a,checkin);
  for(const category of ["sleep","food","move","mind"]){
    assert.ok(rows.some(r=>r.category===category&&r.guidance?.kind==="reading"));
    assert.ok(rows.some(r=>r.category===category&&r.guidance?.kind==="music"));
  }
  assert.ok(rows.find(r=>r.id==="sleep-music")!.guidance!.items.some(i=>i.name.includes("앰비언트")));
  assert.ok(rows.find(r=>r.id==="food-music")!.guidance!.items.some(i=>i.name.includes("보사노바")));
  assert.ok(rows.find(r=>r.id==="mind-music")!.guidance!.items.some(i=>i.name.includes("로파이")));
  for(const r of rows)assert.ok(routineSchema.safeParse(r).success,r.id);
});

test("식사 루틴에 식품과 영양소 역할을 함께 제공하고 검색할 수 있다",()=>{
  const rows=getRoutineCatalog(a,checkin);
  for(const id of ["food-first","food-color","food-protein","food-menu","food-fruit","food-plan","food-label"]){
    const r=rows.find(r=>r.id===id)!;assert.equal(r.guidance?.kind,"food");assert.ok(r.guidance!.items.length>=2);
    assert.ok(r.guidance!.sources.length>0);assert.ok(r.guidance!.caution.includes("보장하지"));
  }
  assert.ok(routineSearchText(rows.find(r=>r.id==="food-color")!).includes("브로콜리"));
  assert.ok(routineSearchText(rows.find(r=>r.id==="mind-music")!).includes("로파이"));
});

test("채식·비건에는 식물성 예시를, 상세 미확인 제한식·알레르기에는 추천 보류를 적용한다",()=>{
  for(const diet of ["vegan","vegetarian"] as const){
    const rows=getRoutineCatalog({...a,diet},checkin);
    const guide=rows.find(r=>r.id==="food-protein")!.guidance!;
    assert.ok(guide.items.every(i=>!`${i.name} ${i.note}`.match(/달걀|닭고기|생선|요거트/)));
  }
  for(const profile of [{...a,allergy:true},{...a,diet:"restricted" as const}]){
    const guide=getRoutineCatalog(profile,checkin).find(r=>r.id==="food-color")!.guidance!;
    assert.equal(guide.items.length,0);assert.ok(guide.intro.includes("보류"));
  }
});

test("일반 식단의 단백질 추천은 식물성과 동물성을 함께 구분해 제안한다",()=>{
  const guide=guidanceForRoutine({id:"food-protein"},{...a,diet:"mixed",allergy:false})!;
  assert.ok(guide.items.some(i=>i.name.startsWith("식물성")));
  assert.ok(guide.items.some(i=>i.name.startsWith("동물성")));
  assert.ok(guide.items.some(i=>i.note.includes("간단히 준비")));
  for(const diet of ["vegetarian","vegan"] as const){
    const plant=guidanceForRoutine({id:"food-protein"},{...a,diet,allergy:false})!;
    assert.ok(plant.items.every(i=>i.name.startsWith("식물성")));
  }
});

test("기존 루틴도 새 안내를 표시하고 현재 식이 제한을 우선한다",()=>{
  assert.ok(guidanceForRoutine({id:"food-color"},a)?.items.some(i=>i.name.includes("브로콜리")));
  const saved=getRoutineCatalog(a,checkin).find(r=>r.id==="food-protein")!;
  assert.equal(guidanceForRoutine({...saved,source:"catalog"},{...a,allergy:true})?.items.length,0);
  // Shared guidance is resolved by ID at display time, not duplicated in 90 days of records.
  assert.ok(buildRoutines(a,checkin).every(r=>r.guidance===undefined));
});
