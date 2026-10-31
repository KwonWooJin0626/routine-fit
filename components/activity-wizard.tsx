"use client";
import { useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { Answers, AppState, Day } from "@/lib/model";
import { localDate } from "@/lib/model";
import { activityAllocation, activityDomains, activityGoals, activityWhen, activityProfileSchema, activityPreferencesSchema, dayNames, newActivityProfile, orderedDays, type ActivityDomain, type ActivityProfile } from "@/lib/activity-profile";
import { activityCandidates, activityCompatibility, activityDefinition, baseActivityQuestions, selectedEquipment, toggleEquipment, exerciseAdjustment, type ActivityQuestion } from "@/lib/activity-catalog";
import { checkpointActivity } from "@/lib/activity-checkpoint";
import { ActivitySummary } from "./activity-summary";
import { ActivityCategoryResult } from "./activity-category-result";
import { activityRoutine } from "@/lib/activity-recommendations";
import { exerciseRanges } from "@/lib/basic-profile";
import { occurrencesInWindow, mondayOf, addDate } from "@/lib/planner";
import { QuestionFrame } from "./question-frame";
import { ChoiceButtons } from "./choice-buttons";
import { Input } from "./forms";

type Step={id:string;title:string;hint:string;question?:ActivityQuestion};
function profileSteps(p:ActivityProfile):Step[]{
  return [
    {id:"goal",title:`${activityDomains[p.domain]}에서 원하는 변화는요?`,hint:"답변에 따라 활동 후보가 달라져요."},
    {id:"current",title:"최근에는 얼마나 자주 하고 있나요?",hint:"현재 상태와 앞으로의 목표는 별도로 저장해요. 익숙한 정도를 정하는 데 사용해요."},
    {id:"daily",title:"활동하는 날, 하루에 얼마나 하고 싶나요?",hint:"매일 해야 한다는 뜻은 아니에요. 활동일의 최대 희망 시간을 확인해요."},
    {id:"weekly",title:"일주일에는 총 얼마나 하고 싶나요?",hint:"하루 시간·요일과 함께 주간 분량을 구성해요. 예정 시간은 실제 실천 시간이 아니에요."},
    ...baseActivityQuestions[p.domain].map(q=>({id:`field-${q.key}`,title:q.title,hint:q.why,question:q})),
    ...(p.domain==="language"&&p.fields.language==="other"?[{id:"language-name",title:"어떤 언어인가요?",hint:"생략하면 선택한 언어로 안내해요.",question:{key:"languageName",title:"언어 이름",why:"선택",type:"text" as const}}]:[]),
    ...(p.domain==="career"&&p.fields.field==="other"?[{id:"field-name",title:"배우는 분야를 알려주실래요?",hint:"생략해도 돼요.",question:{key:"fieldName",title:"분야 이름",why:"선택",type:"text" as const}}]:[]),
    ...(p.domain==="language"&&p.goal==="exam"?[{id:"exam-name",title:"준비하는 시험이 있나요?",hint:"없으면 비워두세요.",question:{key:"examName",title:"시험 이름",why:"선택",type:"text" as const}},{id:"exam-date",title:"시험 날짜가 있나요?",hint:"날짜는 추천에 표시하며 정확한 학습 분량은 임의로 계산하지 않아요.",question:{key:"deadline",title:"시험 날짜",why:"선택",type:"date" as const}}]:[]),
    {id:"candidate",title:"먼저, 마음에 드는 활동을 골라보세요",hint:"후보를 고르면 그 활동에 필요한 질문만 이어져요. 확정 전까지 기존 루틴은 바뀌지 않아요."},
    ...(activityDefinition(p)?.questions??[]).map(q=>({id:`detail-${q.key}`,title:q.title,hint:q.why,question:q})),
    {id:"days",title:"어느 요일에 하고 싶나요?",hint:"주간 목표를 선택한 요일에 나눠요. 한 요일이 하루 희망 시간을 넘으면 조정해요."},
    {id:"when",title:"언제 실행하는 것이 편한가요?",hint:"계획표가 있으면 식사·수면·이동·다른 일정을 피해 배치해요. 원하는 시간에 여유가 없으면 알려드려요."},
    {id:"review",title:"이 활동으로 시작할까요?",hint:"시간·방식·요일을 확인해주세요. 실제 실천시간은 완료 후 직접 기록한 값만 집계해요."},
  ];
}

export function ActivityWizard({state,busy,error,onComplete,onClose,onPlan,onResultsClose}:{state:AppState;busy:boolean;error:string;onComplete:(a:Answers)=>Promise<Day>;onClose:()=>void;onPlan:()=>void;onResultsClose?:()=>void}){
  const initial=state.answers.activities;
  const [stage,setStage]=useState<"start"|"domains"|"flow"|"result">(initial?.pendingDomains?.length?"flow":"start");
  const [route,setRoute]=useState<"routine"|"schedule">(initial?.route??(state.answers.planningStyle==="planned"?"schedule":"routine"));
  const [selected,setSelected]=useState<ActivityDomain[]>(initial?.pendingDomains?.length?initial.selectedDomains??initial.pendingDomains:initial?.profiles.filter(p=>p.enabled).map(p=>p.domain)??[]);
  const [draft,setDraft]=useState<Partial<Record<ActivityDomain,ActivityProfile>>>(()=>Object.fromEntries(initial?.profiles.map(p=>[p.domain,p])??[]));
  const [domainIndex,setDomainIndex]=useState(initial?.pendingDomains?.length?(initial.selectedDomains??initial.pendingDomains).indexOf(initial.pendingDomains[0]):0),[step,setStep]=useState(0),[notice,setNotice]=useState(""),[candidatePage,setCandidatePage]=useState(0),[budget,setBudget]=useState(state.answers.available);
  const [result,setResult]=useState<{profile:ActivityProfile;day:Day;pending:ActivityDomain[]}|null>(null);
  const domain=selected[domainIndex]??"exercise",p=draft[domain]??newActivityProfile(domain),steps=profileSteps(p),screen=steps[Math.min(step,steps.length-1)];
  const update=(patch:Partial<ActivityProfile>)=>{setNotice("");setDraft(old=>({...old,[domain]:{...(old[domain]??p),...patch}}));};
  const field=(key:string,value:string)=>update({fields:{...p.fields,[key]:value.slice(0,120)}});
  const today=localDate(),week=Array.from({length:7},(_,i)=>addDate(mondayOf(today),i));
  const category=domain==="exercise"?"exercise":domain==="study"?"study":domain==="rest"?"rest":null;
  const observed=week.reduce((n,date)=>n+occurrencesInWindow(state.planner,date).filter(o=>category&&o.block.category===category).reduce((sum,o)=>sum+o.until-o.from,0),0);
  const hasPlanner=!!state.planner?.blocks.length||!!state.schedule.events.length;
  const candidates=activityCandidates(p),activity=activityDefinition(p),compatibility=activityCompatibility(p);
  const profileError=()=>{const parsed=activityProfileSchema.safeParse(p);return parsed.success?"":parsed.error.issues[0].message;};
  const advance=async()=>{
    setNotice("");
    if(stage==="start"){if(route==="schedule"&&!hasPlanner){onPlan();return;}setStage("domains");return;}
    if(stage==="domains"){setDomainIndex(0);setStep(0);setStage("flow");return;}
    if(screen.id==="review"){
      const issue=profileError();if(issue){setNotice(issue);return;}
      try{
        const preferences=checkpointActivity(initial,p,selected,route);
        const day=await onComplete({...state.answers,available:budget,planningStyle:route==="schedule"?"planned":"spontaneous",activities:preferences});
        setResult({profile:p,day,pending:preferences.pendingDomains??[]});setStage("result");
      }catch(e){setNotice((e as Error).message);}
      return;
    }
    setStep(i=>i+1);setCandidatePage(0);
  };
  const back=()=>{setNotice("");if(stage==="domains")setStage("start");else if(stage==="flow"&&step>0)setStep(i=>i-1);else setStage("domains");};
  const title=stage==="start"?"어떤 방식으로 시작할까요?":stage==="domains"?"어떤 분야부터 챙기고 싶나요?":screen.title;
  const disabled=stage==="domains"?!selected.length:stage==="flow"?(screen.id==="goal"?!p.goal:screen.id==="candidate"?!candidates.some(a=>a.id===p.activity):screen.id==="days"?!p.days.length:screen.question?.options?!p.fields[screen.question.key]:false):false;
  if(stage==="result"&&result)return <ActivityCategoryResult profile={result.profile} day={result.day} pending={result.pending} busy={busy} onClose={onResultsClose??onClose} onEdit={()=>{setStage("flow");setStep(profileSteps(result.profile).length-1);}}/>;
  return <QuestionFrame step={stage==="flow"?step:stage==="domains"?1:0} total={stage==="flow"?steps.length:3} title={title} hint={stage==="flow"?screen.hint:stage==="start"?"기초 정보는 재사용하고 새 목표만 알아봐요. 분야를 마칠 때마다 저장하고 결과를 먼저 보여드려요.":stage==="domains"?"처음에는 1~2개 분야를 골라요. 기존 분야의 설정은 보관하고 선택한 분야를 활성화해요.":"목표는 희망 분량, 오늘의 시간은 전체 상한이에요. 완료 기록과 직접 담은 루틴은 유지해요."} onClose={onClose} onBack={stage==="start"?undefined:back} onNext={()=>void advance()} busy={busy} error={notice||error} disabled={disabled} nextLabel={stage==="start"&&route==="schedule"&&!hasPlanner?"계획표 만들기":stage==="flow"&&screen.id==="review"?"이 분야 저장하고 결과 보기":"다음"}>
    <span className="activity-phase">{stage==="flow"?`${activityDomains[domain]} · ${domainIndex+1}/${selected.length}분야`:"목표 → 후보 → 구체화 → 실천"}</span>
    {stage==="start"&&<><ChoiceButtons label="시작 방법" value={route} options={{routine:"먼저 루틴 추천받기",schedule:"일정에 맞춰 추천받기"}} onChange={v=>setRoute(v as typeof route)}/><p className="question-small">{route==="routine"?"기초 정보는 다시 묻지 않아요. 관심 활동부터 고른 뒤 계획표는 나중에 추가할 수 있어요.":hasPlanner?"등록된 일정을 재사용해요. 이번 주의 예정 시간과 목표를 구분해서 확인합니다.":"먼저 고정 일정과 날짜별 일정을 등록해주세요. 계획표의 ‘활동에 맞춘 루틴 구체화’로 돌아와 이어서 시작할 수 있어요."}</p>{hasPlanner&&<button type="button" className="text-link" onClick={onPlan}><CalendarDays size={15}/>계획표 확인·수정</button>}{route==="schedule"&&!hasPlanner&&<button className="text-link" type="button" onClick={()=>{setRoute("routine");setStage("domains");}}>계획표 없이 루틴부터 받을게요</button>}</>}
    {stage==="domains"&&<><div className="activity-domain-grid" role="group" aria-label="관심 분야 최대 두 개">{Object.entries(activityDomains).map(([id,label])=><button type="button" key={id} aria-pressed={selected.includes(id as ActivityDomain)} disabled={!selected.includes(id as ActivityDomain)&&selected.length>=2} onClick={()=>{const d=id as ActivityDomain;setSelected(old=>old.includes(d)?old.filter(v=>v!==d):[...old,d]);setDraft(old=>({...old,[d]:old[d]??newActivityProfile(d)}));}}>{label}</button>)}</div><p className="question-small">이후 선택한 활동만 질문해요. 현재 설정하지 않는 분야의 기초 추천도 아래 추천 목록에서 직접 고를 수 있어요.</p></>}
    {stage==="flow"&&<>
      {screen.id==="goal"&&<ChoiceButtons label="이번 분야의 목표" value={p.goal} options={activityGoals[domain]} onChange={goal=>update({goal})}/>}
      {screen.id==="current"&&<>{domain==="exercise"&&state.answers.basic&&<p className="activity-baseline">기초 설문에 답한 최근 주간 운동량: {exerciseRanges[state.answers.basic.exerciseRange]} · 범위를 정확한 분으로 바꾸지 않아요.</p>}<ChoiceButtons label="최근 활동 상태" value={p.current} options={{none:"거의 안 해요",sometimes:"가끔 해요",regular:"꾸준히 해요",unknown:"잘 모르겠어요",...(domain==="exercise"&&state.answers.basic?{profile:"위 기초 설문 정보 사용"}:{})}} onChange={current=>update({current:current as ActivityProfile["current"]})}/></>}
      {screen.id==="daily"&&<><ChoiceButtons label="활동일의 하루 희망 시간" value={String(p.daily)} options={Object.fromEntries((domain==="study"||domain==="career"?[15,30,60,90,120]:[5,10,20,30,45,60]).map(n=>[n,`${n}분`]))} onChange={daily=>update({daily:Number(daily),dailySource:"self"})}/><button type="button" className="text-link" onClick={()=>update({daily:10,dailySource:"proposal"})}>10분부터 시작하는 제안 선택</button><details className="question-help"><summary>다른 시간 직접 선택</summary><Input label="하루 목표 분 (5~120)" type="number" min={5} max={120} value={p.daily} onChange={v=>update({daily:Number(v),dailySource:"self"})}/></details><p className="question-small">현재 선택: {p.daily}분 · {p.dailySource==="proposal"?"서비스 제안 · 다음을 눌러 확인":"직접 선택"}</p></>}
      {screen.id==="weekly"&&<><ChoiceButtons label="주간 총 목표 시간" value={p.weekly===null?"none":String(p.weekly)} options={{30:"30분",60:"1시간",120:"2시간",180:"3시간",300:"5시간",none:"주간 목표 없이"}} onChange={v=>update({weekly:v==="none"?null:Number(v),weeklySource:v==="none"?"none":"self"})}/><button type="button" className="text-link" onClick={()=>update({weekly:p.daily*3,weeklySource:"proposal"})}>하루 {p.daily}분 × 주 3회 제안 선택</button>{observed>0&&observed<=840&&<button type="button" className="text-link" onClick={()=>update({weekly:observed,weeklySource:"planner"})}>이번 주 계획표의 {observed}분 사용 (예정)</button>}<details className="question-help"><summary>주간 시간 직접 입력</summary><Input label="주간 목표 분 (5~840)" type="number" min={5} max={840} value={p.weekly??""} onChange={v=>update({weekly:v===""?null:Number(v),weeklySource:v===""?"none":"self"})}/></details><p className="question-small">현재 선택: {p.weekly===null?"주간 목표 없음":`${p.weekly}분`} · {p.weeklySource==="planner"?"계획표 예정 시간":p.weeklySource==="proposal"?"서비스 제안 · 다음을 눌러 확인":"직접 선택"}</p></>}
      {screen.question&&<><ActivityField key={`${domain}-${screen.id}`} question={screen.question} value={p.fields[screen.question.key]??""} onChange={v=>field(screen.question!.key,v)}/>{screen.question.key==="subject"&&<div className="activity-suggestions">{[...new Set(state.planner?.blocks.filter(b=>b.category==="study").map(b=>b.title)??[])].slice(0,4).map(title=><button type="button" key={title} onClick={()=>field("subject",title)}>{title}</button>)}</div>}</>}
      {screen.id==="candidate"&&<><div className="activity-candidates" role="group" aria-label="추천 활동 후보">{candidates.slice(candidatePage*3,candidatePage*3+3).map(a=><button type="button" key={a.id} aria-pressed={p.activity===a.id} onClick={()=>update({activity:a.id})}><b>{a.title}</b><span>{p.daily}분 이내 · {activityDomains[domain]}{a.goals.includes(p.goal)?" · 선택한 목표에 맞춤":" · 다른 방식도 비교해요"}</span></button>)}</div>{candidates.length>3&&<div className="supplement-pagination"><button type="button" disabled={!candidatePage} onClick={()=>setCandidatePage(v=>v-1)}>이전 후보</button><span>{candidatePage+1}/{Math.ceil(candidates.length/3)}</span><button type="button" disabled={(candidatePage+1)*3>=candidates.length} onClick={()=>setCandidatePage(v=>v+1)}>다른 활동 보기</button></div>}{activity&&<p className="question-small">선택: {activity.title}</p>}</>}
      {screen.id==="days"&&<><div className="activity-days" role="group" aria-label="실행 요일">{orderedDays.map(d=><button type="button" key={d} aria-pressed={p.days.includes(d)} onClick={()=>update({days:p.days.includes(d)?p.days.filter(v=>v!==d):[...p.days,d]})}>{dayNames[d]}</button>)}</div><div className="activity-suggestions"><button type="button" onClick={()=>update({days:[1,2,3,4,5]})}>평일</button><button type="button" onClick={()=>update({days:[...orderedDays]})}>매일</button></div><p className="question-small">하루 최대 {p.daily}분 · 주간 목표 {p.weekly??"없음"}{p.weekly!==null?"분":""} · {p.days.length}일 선택</p>{p.weekly!==null&&(p.weekly>p.daily*p.days.length||p.weekly<5*p.days.length)&&<div className="activity-adjust"><p>선택한 요일에는 하루 희망 시간 이내, 회당 5분 이상으로 목표를 나눌 수 없어요.</p><button type="button" className="text-link" disabled={!p.days.length} onClick={()=>update({weekly:p.daily*p.days.length,weeklySource:"self"})}>주간 목표를 {p.daily*p.days.length}분으로 조정</button><button type="button" className="text-link" onClick={()=>setStep(steps.findIndex(s=>s.id==="daily"))}>하루 시간 변경</button></div>}</>}
      {screen.id==="when"&&<ChoiceButtons label="실행 시점" value={p.when} options={hasPlanner?activityWhen:Object.fromEntries(Object.entries(activityWhen).filter(([k])=>k!=="calendar"))} onChange={when=>update({when:when as ActivityProfile["when"]})}/>}
      {screen.id==="review"&&<><ActivitySummary profile={p} compact/><p className="question-small">이 분야를 저장하면 추천 결과를 바로 볼 수 있어요. 다른 분야는 나갔다가 이어서 진행해요.</p>{domain==="exercise"&&exerciseAdjustment(p).level!=="normal"&&<div className="activity-adjust" role="status"><p>{exerciseAdjustment(p).level==="hold"?"답변은 저장할 수 있어요. 운동 실행은 보류하고 준비 활동을 제안해요.":"뛰기·점프 등 충격이 큰 동작을 제외해 제안해요."}</p><button type="button" className="text-link" onClick={()=>setStep(steps.findIndex(s=>s.id==="candidate"))}>다른 활동 비교하기</button></div>}{compatibility&&<div className="activity-adjust"><p>{compatibility}</p>{domain==="exercise"&&<button type="button" className="button secondary" onClick={()=>{update({activity:"prepare"});setStep(steps.findIndex(s=>s.id==="candidate"));}}>운동 준비 활동으로 바꾸기</button>}<button type="button" className="text-link" onClick={()=>setStep(steps.findIndex(s=>s.id==="candidate"))}>다른 활동 보기</button></div>}<details className="question-help"><summary>오늘 전체 루틴 시간: {budget}분 · 변경하기</summary><ChoiceButtons label="오늘 모든 분야에 쓸 수 있는 시간" value={String(budget)} options={Object.fromEntries([...new Set([15,30,budget,60,120,240])].sort((a,b)=>a-b).map(n=>[n,`${n}분`]))} onChange={v=>setBudget(Number(v))}/><p>분야들이 이 시간을 함께 사용해요. 주간 목표는 유지돼요.</p></details><details className="question-help"><summary>실행 순서와 쉬운 대안</summary><p>{activity?activityRoutine(p,p.daily).detail:"활동을 선택해주세요."}</p><p>{activity?.fallback}</p></details>{profileError()&&<p className="question-small">{profileError()}</p>}</>}
    </>}

  </QuestionFrame>;
}

function ActivityField({question:q,value,onChange}:{question:ActivityQuestion;value:string;onChange:(v:string)=>void}){
  if(q.multiple&&q.options)return <div className="choice-field"><p>사용 가능한 기구 · 복수 선택</p><div className="choice-buttons" role="group" aria-label="사용 가능한 기구 복수 선택">{Object.entries(q.options).map(([key,label])=><button type="button" key={key} aria-pressed={selectedEquipment(value).includes(key)} onClick={()=>onChange(toggleEquipment(value,key))}>{label}</button>)}</div></div>;
  if(q.options)return <ChoiceButtons label="나의 선택" value={value} options={q.options} onChange={onChange}/>;
  return <><Input label={q.type==="date"?"날짜 (선택)":"짧게 입력 (선택)"} type={q.type==="date"?"date":"text"} value={value} onChange={v=>onChange(v.slice(0,120))}/><p className="question-small">없거나 아직 정하지 않았다면 비워두고 다음으로 넘어가세요.</p></>;
}
