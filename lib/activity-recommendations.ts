import type { Answers, Checkin, Day, Routine, Schedule } from "./model";
import { activityAllocation, activityDomains, activityGoals, activityWhen, type ActivityProfile } from "./activity-profile";
import { activityCompatibility, activityDefinition } from "./activity-catalog";

const dayIndex=(date:string)=>new Date(`${date}T12:00Z`).getUTCDay();
export function activityMinutesOn(p:ActivityProfile,date:string){return activityAllocation(p)[dayIndex(date)]??0;}
const labels:Record<string,string>={english:"영어",japanese:"일본어",chinese:"중국어",fiction:"소설",essay:"에세이",science:"과학",human:"인문·사회",economy:"경제·경영",code:"프로그래밍",design:"디자인",write:"글쓰기",certificate:"자격증",job:"취업 준비",desk:"책상",room:"방",kitchen:"주방",digital:"휴대폰·파일",todo:"할 일 목록",paper:"종이책",ebook:"전자책",audio:"오디오북",beginner:"초보자 자세 안내",familiar:"익숙한 동작",chair:"의자 등 보조도구"};
const safeText=(s:string|undefined)=>s&&!['unknown','other','existing','any'].includes(s)?labels[s]??s:"";
export function activityRoutine(p:ActivityProfile,minutes:number):Routine{
  const a=activityDefinition(p)!;
  const topic=safeText(p.fields.subject||p.fields.book||p.fields.languageName||p.fields.language||p.fields.output||p.fields.target||p.fields.genre||p.fields.fieldName||p.fields.field);
  let detail=a.description;
  if(topic)detail=`${topic}: ${detail}`;
  if(p.fields.progress==="start")detail+="  먼저 사용할 자료와 첫 부분을 확인해요.";
  if(p.fields.progress==="finish")detail+="  남은 부분 하나를 골라 확인하고 마무리해요.";
  if(p.fields.deadline)detail+=` 마감: ${p.fields.deadline}.`;
  if(p.fields.unit)detail+=` 주제: ${p.fields.unit}.`;
  if(p.fields.nextTask)detail+=` 다음 작업: ${p.fields.nextTask}.`;
  if(p.fields.material==="no")detail="사용할 자료 하나를 고르는 것부터 시작해요. 자료의 내용이나 정답을 임의로 만들지 않아요.";
  if(p.domain==="reading")detail+=p.fields.format==="audio"?" 선택한 오디오북으로 진행해요.":p.fields.format==="ebook"?" 전자책으로 진행해요.":"";
  const records:Record<string,string>={sentence:"문장 하나 남기기",feeling:"느낌 한 줄 남기기",summary:"핵심 내용 한 줄 정리하기"};
  if(records[p.fields.record])detail+=` 마지막에는 ${records[p.fields.record]}.`;
  if(p.domain==="language"&&p.fields.level==="start")detail+=" 처음에는 한 문장부터 시작해요.";
  if(p.domain==="career"&&p.fields.level==="start")detail+=" 처음이면 작은 예제를 따라 하는 것부터 해요.";
  if(p.domain==="organize")detail+=p.fields.scope==="few"?" 물건 몇 개만 골라요.":" 전체를 끝내지 않아도 괜찮아요.";
  if(p.activity==="run"&&["first","walk"].includes(p.fields.running))detail="걷기를 중심으로 시작해요. 아직 익숙하지 않은 달리기를 무리해서 추가하지 않아요.";
  if(p.activity==="gym"&&p.fields.equipmentSkill==="no")detail="오늘은 기구 사용 안내를 받고 사용할 수 있는 운동을 확인해요. 모르는 기구를 혼자 사용하지 않아요.";
  if(p.activity==="home")detail+=` ${p.fields.noise!=="yes"?"점프 없는 방식으로 해요. ":""}${p.fields.equipment==="none"?"기구 없이 진행해요.":"선택한 준비물을 확인해요."}`;
  if(p.activity==="yoga")detail+=` ${safeText(p.fields.yogaGuide)} 방식으로 골라요.`;
  if(p.activity==="music")detail=p.fields.sound==="nature"?"자연음 중 편안한 소리를 골라 쉬어요. 싫으면 소리 없이 쉬어도 괜찮아요.":`${p.fields.sound==="vocal"?"어쿠스틱 보컬·잔잔한 팝":p.fields.mood==="bright"?"밝은 어쿠스틱·재즈":p.fields.mood==="familiar"?"평소 좋아하던 장르":"앰비언트·솔로 피아노·잔잔한 재즈"} 중 직접 들어보고 편한 음악을 골라요. 방해되면 끄세요.`;
  return {id:`activity-${p.domain}-${p.activity}`,category:a.category,title:`${topic?`${topic} · `:""}${a.title}`.slice(0,150),detail:detail.slice(0,300),reason:`${activityDomains[p.domain]}의 ‘${activityGoals[p.domain][p.goal]}’ 목표, 활동일 최대 ${p.daily}분${p.weekly===null?"":`, 주 ${p.weekly}분`}과 선택한 방식·환경을 반영했어요. 실제 실천 시간이나 능력을 측정한 결과는 아니에요.`.slice(0,300),minutes,when:activityWhen[p.when],fallback:a.fallback,source:"auto",activity:{domain:p.domain,id:p.activity,goalMinutes:minutes}};
}
export function recommendActivities(a:Answers,c:Checkin,history:Day[],date:string,schedule?:Schedule,omitIds?:Set<string>):Routine[]{
  const profiles=a.activities?.profiles.filter(p=>p.enabled)??[],rows:Routine[]=[];
  let remaining=Math.max(0,c.minutes);
  const low=c.unwell||c.activityMode==="light"||(c.reported!==false&&(c.energy<=2||(c.stressKnown!==false&&c.stress>=4)||(c.sleepKnown!==false&&c.sleep<6)||c.sleepQuality==="poor"));
  if(c.activityMode==="rest")return [];
  for(const p of profiles){
    if(omitIds?.has(`activity-${p.domain}-${p.activity}`))continue;
    const goal=activityMinutesOn(p,date);if(!goal||activityCompatibility(p))continue;
    const prior=history.filter(d=>d.date<date).sort((x,y)=>y.date.localeCompare(x.date)).flatMap(d=>d.routines.filter(r=>r.activity?.domain===p.domain).map(r=>({r,feedback:d.activityFeedback?.[r.id],status:d.statuses[r.id],note:d.notes[r.id]}))).slice(0,3);
    const feedback=prior.find(x=>x.feedback?.reason)?.feedback?.reason;
    const category=p.domain==="exercise"?"exercise":p.domain==="study"?"study":p.domain==="career"||p.domain==="language"||p.domain==="reading"?"growth":p.domain==="rest"?"rest":null;
    const linked=schedule?.events.find(e=>category&&e.category===category&&!c.unwell&&p.domain==="exercise");
    if(linked){const r=activityRoutine(p,0);rows.push({...r,when:`${linked.start}–${linked.end} · 등록 일정`,detail:`‘${linked.title}’ 일정이 이미 있어 운동 시간을 추가하지 않았어요. 실제로 실천한 뒤 체크하세요.`,activity:{...r.activity!,goalMinutes:goal,linkedEvent:linked.id}});continue;}
    if(c.unwell&&p.domain==="exercise")continue;
    if(p.domain==="exercise"&&(low||feedback==="condition"))continue;
    if(remaining<1)continue;
    const reduce=feedback==="time"||feedback==="hard"||prior.some(x=>x.note==="time");
    const minutes=Math.min(goal,remaining,low?5:120,(p.current==="none"||p.current==="unknown"||(p.domain==="exercise"&&p.fields.experience==="first"))?10:120,reduce?Math.max(1,Math.floor((prior[0]?.r.minutes??goal)/2)):120);
    const r=activityRoutine(p,minutes),overhead=p.domain==="exercise"?Number(p.fields.overhead??0):0;
    if(overhead+minutes>remaining){if(overhead>=remaining)continue;r.minutes=remaining-overhead;}
    remaining-=r.minutes+overhead;
    rows.push({...r,detail:`${r.detail}${r.minutes<goal?` 오늘은 ${r.minutes}분의 짧은 버전이에요. 주간 목표는 유지돼요.`:""}${overhead?` 이동·준비 ${overhead}분도 따로 확보해요.`:""}`.slice(0,300),reason:`${r.reason}${low?" 오늘은 가볍게 조정했어요.":reduce?" 이전의 시간·난이도 피드백으로 분량을 줄였어요.":feedback==="dislike"||feedback==="environment"?" 활동이나 환경 변경은 ‘루틴 구체화’에서 선택할 수 있어요.":""}`.slice(0,300),activity:{...r.activity!,goalMinutes:goal,overheadMinutes:overhead}});
  }
  return rows;
}
