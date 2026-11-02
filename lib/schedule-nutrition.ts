import type { AppState } from "./model";
import { toMinutes } from "./model";
import { addDate, occurrencesInWindow } from "./planner";
import type { Occurrence } from "./planner";
import { plannerCategories, type PlannerBlock } from "./planner-model";
import type { NutritionProfile } from "./nutrition-profile";

export type GuideId="protein"|"hydration"|"meal"|"focus"|"recovery"|"screen"|"exercise";
export type ExerciseMode="strength"|"endurance"|"mixed"|"light"|"unknown";
export type ScheduleGuide={
  id:GuideId;title:string;reason:string;nutrient:string;benefit:string;action:string;
  ingredientIds:string[];sourceTitle:string;source:string;context:string;
  question?:{title:string;options:Record<"possible"|"difficult"|"unknown",string>};
  answer?:"possible"|"difficult"|"unknown";feedback?:string;
};
const sport="https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-Consumer/";
const diet="https://ods.od.nih.gov/HealthInformation/ODS_Frequently_Asked_Questions/";

export function exerciseMode(o:Occurrence,p?:NutritionProfile):ExerciseMode{
  if(o.block.category!=="exercise")return "unknown";
  const saved=p?.exerciseModes.find(x=>x.blockId===(o.block.groupId??o.block.id)&&x.title===o.block.title);
  if(saved)return saved.mode;
  // Category is required: a lecture about running is not a workout.
  const text=o.block.title.toLowerCase();
  if(/취소|안 함|안함|쉬는 날/.test(text))return "unknown";
  const strength=/근력|웨이트|weight|저항 운동|스쿼트|데드리프트/.test(text);
  const endurance=/달리기|러닝|런닝|조깅|자전거|사이클|수영|마라톤|running|cycling/.test(text);
  if(strength&&endurance)return "mixed";
  if(strength)return "strength";
  if(endurance)return "endurance";
  if(/요가|스트레칭|산책|가벼운 걷기|필라테스/.test(text))return "light";
  return "unknown";
}

type Span={from:number;until:number};
function unionMinutes(spans:Span[]){
  let total=0,end=-Infinity;
  for(const s of [...spans].sort((a,b)=>a.from-b.from)){total+=Math.max(0,s.until-Math.max(end,s.from));end=Math.max(end,s.until);}
  return total;
}
// Work/exercise during a registered break does not count toward occupied time.
function activeSpans(o:Occurrence,date:string):Span[]{
  const b=o.block;
  if(!b.breakStart||!b.breakEnd)return [{from:o.from,until:o.until}];
  const shift=(Date.parse(`${o.date}T12:00Z`)-Date.parse(`${date}T12:00Z`))/86400000*1440;
  const start=shift+toMinutes(b.start),pause=start+(toMinutes(b.breakStart)-toMinutes(b.start)+1440)%1440;
  const end=start+(toMinutes(b.breakEnd)-toMinutes(b.start)+1440)%1440;
  return [{from:o.from,until:Math.min(o.until,pause)},{from:Math.max(o.from,end),until:o.until}].filter(s=>s.until>s.from);
}
function fingerprint(rows:Occurrence[],date:string,p?:NutritionProfile){
  const value=JSON.stringify(rows.map(o=>[o.block.id,o.date,o.block.title,o.block.category,o.from,o.until,o.block.breakStart,o.block.breakEnd,exerciseMode(o,p)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
  return `${date}:${(hash>>>0).toString(36)}`;
}

function nutritionOccurrences(state:AppState,date:string):Occurrence[]{
  const legacy=state.schedule.events.filter(e=>!e.id.startsWith("plan-")).map(e=>{
    const category=e.category&&e.category in plannerCategories?e.category as PlannerBlock["category"]:"social";
    return {block:{id:e.id,title:e.title,category,location:"",task:e.description??"",start:e.start,end:e.end,mental:1,physical:1,shade:1,kind:"fixed",date,weekdays:[],excludedDates:[],breakStart:e.breakStart,breakEnd:e.breakEnd} as PlannerBlock,date,from:toMinutes(e.start),until:toMinutes(e.start)+(toMinutes(e.end)-toMinutes(e.start)+1440)%1440};
  });
  // Legacy daily events also intersect the previous night's tail.
  const legacyRows=legacy.flatMap(o=>[o,{...o,date:addDate(date,-1),from:o.from-1440,until:o.until-1440}]).filter(o=>o.from<1440&&o.until>0).map(o=>({...o,from:Math.max(0,o.from),until:Math.min(1440,o.until)}));
  return [...occurrencesInWindow(state.planner,date),...legacyRows].filter(o=>!state.planner?.records?.some(r=>r.blockId===o.block.id&&r.date===o.date&&r.status==="skipped"));
}

export function scheduleNutrition(state:AppState,date:string){
  if(!state.answers.supplementOptIn)return {guides:[],exerciseChoices:[],exerciseMinutes:0,weeklyExerciseDays:0,hasSchedule:false};
  const rows=nutritionOccurrences(state,date);
  const profile=state.nutrition,context=fingerprint(rows,date,profile),exercise=rows.filter(o=>o.block.category==="exercise");
  const strength=exercise.filter(o=>["strength","mixed"].includes(exerciseMode(o,profile)));
  const cardio=exercise.filter(o=>["endurance","mixed"].includes(exerciseMode(o,profile)));
  const exerciseMinutes=unionMinutes(exercise.flatMap(o=>activeSpans(o,date)));
  const week=Array.from({length:7},(_,i)=>nutritionOccurrences(state,addDate(date,i-6)));
  const weeklyExerciseDays=week.filter(day=>day.some(o=>o.block.category==="exercise")).length;
  const weeklyStrengthDays=new Set(week.flat().filter(o=>o.date>=addDate(date,-6)&&o.date<=date&&["strength","mixed"].includes(exerciseMode(o,profile))).map(o=>o.date)).size;
  const guides:ScheduleGuide[]=[];
  const add=(g:Omit<ScheduleGuide,"context">)=>guides.push({...g,context});
  const titles=(list:Occurrence[])=>[...new Set(list.map(o=>o.block.title))].slice(0,2).join(" · ");
  if(strength.length||cardio.length)add({id:"protein",title:"운동하는 날, 단백질 식사를 준비해요",reason:`${titles([...strength,...cardio])} 일정이 있어요. 운동은 예정이며 완료 여부와 실제 섭취량은 별도로 확인해요.`,nutrient:"단백질",benefit:"단백질은 근육을 포함한 신체 조직의 유지와 회복에 필요한 영양소예요.",action:"운동 전후 먹을 식사를 준비해요. 음식·섭취 정보를 확인하면 식품 대안과 보충 방법을 비교할 수 있어요.",ingredientIds:["protein",...(strength.length&&weeklyStrengthDays>=2?["creatine"]:[])],sourceTitle:"NIH · 운동과 영양제",source:sport,question:{title:"이 날짜에 단백질 식품을 챙길 수 있나요?",options:{possible:"챙길 수 있어요",difficult:"챙기기 어려워요",unknown:"아직 모르겠어요"}}});
  if(cardio.length)add({id:"hydration",title:"유산소 운동 전 식사와 수분을 챙겨요",reason:`${titles(cardio)} 일정이 있어요. 운동 시간과 환경에 맞춰 준비해요.`,nutrient:"탄수화물 · 수분",benefit:"탄수화물은 운동에 쓰는 에너지 공급원이며, 수분은 체온 조절 등 신체 기능에 필요해요.",action:"운동 전후 식사와 마실 물을 준비해요. 전해질은 운동 시간·환경·발한 상황을 함께 확인해요.",ingredientIds:[],sourceTitle:"NIH · 운동과 영양제",source:sport,question:{title:"오래 운동하거나 땀을 많이 흘릴 예정인가요?",options:{possible:"그럴 예정이에요",difficult:"아니요",unknown:"아직 모르겠어요"}}});
  // A lunch-window occupancy rule is an interface heuristic, not a diagnosis.
  const lunch={from:11*60,until:14*60};
  const lunchBusy=unionMinutes(rows.filter(o=>o.block.category!=="meal"&&o.block.category!=="rest").flatMap(o=>activeSpans(o,date)).map(s=>({from:Math.max(lunch.from,s.from),until:Math.min(lunch.until,s.until)})).filter(s=>s.until>s.from));
  const lunchMeal=rows.some(o=>o.block.category==="meal"&&o.from<lunch.until&&o.until>lunch.from);
  if(lunchBusy>=120&&!lunchMeal)add({id:"meal",title:"점심 무렵, 식사할 틈을 확인해요",reason:"11–14시 사이 일정이 2시간 이상 있어요. 식사 블록이 없다는 이유로 결식으로 판단하지 않아요.",nutrient:"탄수화물 · 단백질 · 채소를 포함한 식사",benefit:"여러 식품군을 포함한 식사는 에너지와 다양한 영양소를 챙기는 방법이에요.",action:"일정 안의 식사 시간을 표시하거나 휴대하기 편한 식사를 준비해요.",ingredientIds:[],sourceTitle:"NIH · 영양제와 식사 FAQ",source:diet,question:{title:"이 일정 사이에 식사를 할 수 있나요?",options:{possible:"식사할 수 있어요",difficult:"시간 내기 어려워요",unknown:"아직 모르겠어요"}}});
  const screens=rows.filter(o=>["study","work","task","growth"].includes(o.block.category)&&/화면|컴퓨터|모니터|코딩|온라인|영상 편집|개발 작업/.test(o.block.title));
  if(screens.length)add({id:"screen",title:"화면 작업 사이 눈을 쉬게 해요",reason:`${titles(screens)}처럼 화면 작업이 명시된 일정이 있어요.`,nutrient:"화면 휴식 · 눈 관리",benefit:"화면을 바라보는 사이 휴식을 넣어 눈을 편안하게 관리해요.",action:"일정 사이 잠깐 시선을 옮기는 휴식을 넣어요. 화면 시간만으로 눈 영양제를 정하지 않아요.",ingredientIds:[],sourceTitle:"NEI · 안구건조와 생활 관리",source:"https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/dry-eye"});
  const focused=rows.filter(o=>["study","work","task","growth"].includes(o.block.category));
  if(unionMinutes(focused.flatMap(o=>activeSpans(o,date)))>=240)add({id:"focus",title:"긴 일정 사이 식사와 휴식을 확보해요",reason:"학업·업무·과제·자기 개발 일정이 합쳐서 4시간 이상 있어요. 예상 부담을 영양소 결핍으로 해석하지 않아요.",nutrient:"규칙적인 식사 · 휴식",benefit:"식사와 휴식 시간을 미리 확보하면 바쁜 날에도 생활 리듬을 챙기기 쉬워요.",action:"등록한 식사·휴식과 겹치지 않는 여유시간을 살펴보세요. 공부 시간만으로 B군·아연 등을 자동 권하지 않아요.",ingredientIds:[],sourceTitle:"NIH · 영양제와 식사 FAQ",source:diet});
  if(exercise.some(o=>exerciseMode(o,profile)==="light"))add({id:"recovery",title:"가벼운 운동과 평소 식사를 이어가요",reason:`${titles(exercise.filter(o=>exerciseMode(o,profile)==="light"))} 일정이 있어요.`,nutrient:"균형 있는 식사 · 수분",benefit:"다양한 식품과 수분을 챙기며 활동에 맞는 생활 리듬을 유지해요.",action:"식사와 마실 물을 준비해요. 가벼운 활동에 운동 보충제를 필수로 추가하지 않아요.",ingredientIds:[],sourceTitle:"NIH · 영양제와 식사 FAQ",source:diet});
  const exerciseChoices=exercise.filter((o,i,all)=>all.findIndex(x=>(x.block.groupId??x.block.id)===(o.block.groupId??o.block.id))===i);
  const unknownExercise=exerciseChoices.filter(o=>exerciseMode(o,profile)==="unknown");
  if(unknownExercise.length)add({id:"exercise",title:"운동 일정에 맞춰 준비해요",reason:`${titles(unknownExercise)} 일정의 운동 종류는 아직 확인 전이에요.`,nutrient:"식사 · 수분",benefit:"운동 종류에 맞춰 식사와 수분을 준비하는 방법을 살펴볼 수 있어요.",action:"원하면 운동 종류만 한 번 선택해주세요. 같은 블록의 반복 일정에도 재사용해요.",ingredientIds:[],sourceTitle:"NIH · 운동과 영양제",source:sport});
  for(const g of guides){
    if(g.id!=="protein"&&g.id!=="meal"&&g.id!=="hydration")continue;
    const answer=profile?.scheduleChecks.find(x=>x.date===date&&x.kind===g.id&&x.context===context)?.answer;
    g.answer=answer;
    if(!answer)continue;
    if(g.id==="protein")g.feedback=answer==="possible"?"식사로 챙길 계획을 반영했어요. 실제 섭취량을 확인하기 전에는 추가 보충이 필요하다고 판단하지 않아요.":answer==="difficult"?"이 날짜에 챙기기 어렵다는 답변을 반영했어요. 평소 섭취량이나 결핍을 뜻하지 않으며, 식품과 보충 방법을 비교할 수 있어요.":"미확인으로 저장했어요. 식품 예시를 먼저 보고 나중에 바꿀 수 있어요.";
    if(g.id==="meal")g.feedback=answer==="possible"?"일정 사이 식사할 수 있다는 답변을 반영했어요. 식사 일정을 추가하면 다음 안내에도 반영돼요.":answer==="difficult"?"휴대식·식사 준비를 먼저 살펴보세요. 바쁜 일정만으로 영양제를 추가하지 않아요.":"식사 여부는 미확인으로 유지해요. 결식으로 기록하지 않아요.";
    if(g.id==="hydration")g.feedback=answer==="possible"?"운동 시간·환경·발한에 맞는 수분과 식사 준비를 확인해요. 전해질 제품의 필요·섭취량을 이 답변만으로 정하지 않아요.":answer==="difficult"?"평소 식사와 물을 준비하는 안내를 유지해요.":"운동 환경은 미확인으로 저장했어요. 물 준비부터 확인해요.";
  }
  return {guides,exerciseChoices,exerciseMinutes,weeklyExerciseDays,hasSchedule:rows.length>0};
}

export function saveScheduleAnswer(p:NutritionProfile,date:string,kind:"protein"|"meal"|"hydration",context:string,answer:"possible"|"difficult"|"unknown"):NutritionProfile{
  return {...p,scheduleChecks:[...p.scheduleChecks.filter(x=>x.date!==date||x.kind!==kind),{date,kind,context,answer}].slice(-90)};
}
