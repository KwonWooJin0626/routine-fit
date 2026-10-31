"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined, Check, CheckCheck, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Download, Dumbbell, ExternalLink, FileText, Heart, LayoutDashboard, Leaf, LoaderCircle, LogOut, Menu, Moon, Plus, RefreshCw, ScanLine, Settings, ShieldCheck, Sparkles, Sun, Target, Trash2, Upload, X } from "lucide-react";
import { type Answers, type AppState, type Checkin, type Day, type Inbody, type Routine, type Schedule, type TimelineItem, defaultAnswers, defaultSchedule, initialCheckin, localDate, goalLabels, categoryLabels, inbodySchema, stateSchema } from "@/lib/model";
import { analyze, buildDay, buildTimeline, holdUnsafeRoutines, reviseDayRoutines, validateSchedule } from "@/lib/engine";
import { conditionSummary, MAX_DAILY_ROUTINES, routineSourceLabel } from "@/lib/routine-catalog";
import { CustomRoutineDialog, RoutineBuilder } from "./routine-builder";
import { guidanceForRoutine } from "@/lib/routine-guidance";
import { RoutineGuidance } from "./routine-guidance";
import { RoutineSources } from "./evidence-sources";
import { LifestyleAnalysis } from "./lifestyle-analysis";
import { ScheduleWorkspace } from "./schedule-workspace";
import { buildPlannedDay,scheduleForDate,scheduleContext } from "@/lib/planner";
import { type Planner,type PlannerBlock } from "@/lib/planner-model";
import { recordOccurrence } from "@/lib/planner-progress";
import { usePetCompanion } from "./use-pet-companion";
import { PetHome,PetHistory,PetSettings } from "./pet-companion";
import { ExecutionConfirmDialog,type ExecutionDraft } from "./execution-confirm-dialog";
import { routineEffect,blockEffect,executionFor } from "@/lib/pet-guidance";
import type { PetCommand,PetExecution } from "@/lib/pet-model";
import type { SleepRecord } from "@/lib/sleep";
import { editSavedBlockPlans } from "@/lib/planner-edit";
import { removeSavedBlockPlans,restoreSavedBlockPlans,type PlannerChange } from "@/lib/planner-removal";
import { Dialog, Field, Input, Scale, Select, Toggle } from "./forms";
import { ProfileMenu } from "./profile-menu";
import { ResetDataDialog } from "./reset-data-dialog";
import { AccountSignOut } from "./account-sign-out";
import { useChapterScroll } from "./use-chapter-scroll";
import { PlanningStyleChoice } from "./planning-style";
import { DailyCheckin } from "./daily-checkin";
import { NutritionGuide } from "./nutrition-guide";
import type { NutritionProfile } from "@/lib/nutrition-profile";

import { withGrowthProfile } from "@/lib/growth-migration";
import { BasicOnboarding as Onboarding } from "./basic-onboarding";
import { ActivityWizard } from "./activity-wizard";
import { ActivityGoals, ActivityFeedbackForm } from "./activity-goals";
import type { ActivityFeedback } from "@/lib/activity-profile";
import { SafetySurvey } from "./refinement-survey";
import { GrowthAnalysis } from "./growth-analysis";
import { DailyWords } from "./daily-words";
import { SleepWorkspace } from "./sleep-workspace";
import { emptyBasicProfile, growthGoals } from "@/lib/basic-profile";

type View = "today" | "planner" | "analysis" | "supplements" | "report" | "inbody" | "sleep" | "settings";
type Modal = "onboard" | "checkin" | "custom" | "schedule" | "inbody" | "delete" | "info" | "refine" | "safety" | null;
const nav = [{id:"today",label:"오늘의 루틴",icon:LayoutDashboard},{id:"planner",label:"주간·하루 계획",icon:CalendarDays},{id:"analysis",label:"생활패턴 분석",icon:Activity},{id:"sleep",label:"수면 체크인",icon:Moon},{id:"supplements",label:"컨디션·영양",icon:Leaf},{id:"report",label:"주간 리포트",icon:ChartNoAxesCombined},{id:"inbody",label:"InBody 기록",icon:ScanLine}] as const;
const icons = {sleep:Moon,food:Coffee,move:Dumbbell,mind:Heart};
const titles: Record<View, { title: string; subtitle: string }> = {
  today:{title:"오늘도, 나에게 맞게.",subtitle:"완벽한 하루보다, 나를 위한 작은 실천 하나."},
  planner:{title:"내 일정을 담고, 나를 챙기다.",subtitle:"주간 고정 계획부터 하루의 작은 약속까지. 일정과 자기개발 루틴을 하나로."},
  analysis:{title:"나의 일상을 이해하는 시간.",subtitle:"계획의 시간 배분과 실제 실행 기록으로 다음 작은 변화를 찾아요."},
  supplements:{title:"내게 필요한 정보를, 먼저.",subtitle:"식생활을 바탕으로 영양성분을 살피고, 안전하게 선택해요."},
  report:{title:"작은 실천이 쌓인 한 주.",subtitle:"잘한 일은 이어가고, 어려웠던 일은 더 작게 바꿔요."},
  inbody:{title:"몸의 변화도 함께 살펴요.",subtitle:"체성분 기록은 선택이에요. 생활패턴 분석에 맥락을 더해줘요."},
  sleep:{title:"하루의 시작과 마무리를 기록해요.",subtitle:"취침·기상 목표를 정하고 체크인해요. 실제 수면과 확인 시각은 구분합니다."},
  settings:{title:"내 건강정보, 내 선택대로.",subtitle:"프로필부터 데이터 보관까지 직접 관리하세요."},
};

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type":"application/json", ...options?.headers } });
  const result = await response.json() as { error?: string; state: AppState | null; revision: number; day: Day; values: Partial<Inbody> };
  if (!response.ok) throw new Error(result.error ?? "요청을 완료하지 못했어요.");
  return result;
}
function Badge({ children, color = "coral" }: {children:ReactNode;color?:string}) { return <span className={`badge ${color}`}>{children}</span>; }
function Empty({ icon: Icon = FileText, title, children, action }: {icon?: typeof FileText;title:string;children:ReactNode;action?:ReactNode}) { return <div className="empty"><span className="empty-icon"><Icon size={28}/></span><h3>{title}</h3><p>{children}</p>{action}</div>; }
function Panel({ children, className = "" }: { children:ReactNode;className?:string }) { return <section className={`panel ${className}`}>{children}</section>; }
function SectionHead({ label, title, action }: {label?:string;title:string;action?:ReactNode}) { return <div className="section-head"><div>{label && <span className="eyebrow">{label}</span>}<h2>{title}</h2></div>{action}</div>; }

export default function RoutineFit({ user }: {user:{name:string;email:string}|null}) {
  const [state, setState] = useState<AppState|null>(null), [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(!!user), [loadError,setLoadError] = useState("");
  const [demo,setDemo] = useState(false), [view,setView] = useState<View>("today"), [modal,setModal] = useState<Modal>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [toast,setToast] = useState("");
  const [accountMenu,setAccountMenu]=useState<"header"|"sidebar"|null>(null);
  const [mobile,setMobile] = useState(false), [showDates,setShowDates] = useState(false);
  const [removed,setRemoved] = useState<{date:string;routine:Routine;status?:"done"|"partial"|"skipped";note?:string;feedback?:ActivityFeedback}|null>(null);
  const [draft,setDraft]=useState<{answers:Answers;step:number}>();
  const [editing,setEditing]=useState<Routine>();
  const [execution,setExecution]=useState<ExecutionDraft|null>(null);
  const pet=usePetCompanion(state,revision,demo,(next,rev)=>{setState(next);setRevision(rev);});
  const saving = useRef(false);
  const contentRef = useRef<HTMLElement>(null);
  useChapterScroll(contentRef, state ? `${demo ? "demo" : "account"}:${view}` : "landing", { resetPage: true });
  const today = localDate();
  const savedDay = state?.days.find(d => d.date === today);
  const day = savedDay&&state?{...savedDay,routines:holdUnsafeRoutines(savedDay.routines,savedDay.checkin,state.answers.movementLimit)}:savedDay;
  const a = state?.answers;
  const resolvedSchedule=state?scheduleForDate(state.schedule,state.planner,today):defaultSchedule;
  const load = async () => {
    if (!user) return;
    setLoading(true); setLoadError("");
    try { const data = await api("/api/state"); setState(data.state?withGrowthProfile(data.state):null); setRevision(data.revision); if(new URLSearchParams(window.location.search).get("view")==="sleep")setView("sleep");else if(data.state?.answers.planningStyle==="planned")setView("planner"); if (!data.state && new URLSearchParams(window.location.search).has("start")) setModal("onboard"); }
    catch(e) { setLoadError((e as Error).message); } finally {setLoading(false);}
  };
  useEffect(() => { void load(); }, []); // Initial identity is server-provided and stable for the document.
  useEffect(() => { if (!toast) return; const t=setTimeout(()=>setToast(""),4500);return()=>clearTimeout(t); },[toast]);
  async function persist(next: AppState, message?: string) {
    const parsed=stateSchema.safeParse(next); if(!parsed.success) throw new Error("입력값을 확인해주세요. 일부 데이터가 올바르지 않아요.");
    if (!demo) { const data = await api("/api/state",{method:"PUT",body:JSON.stringify({state:parsed.data,revision})}); setRevision(data.revision); }
    setState(parsed.data); if(message)setToast(message);
  }
  async function perform(action:()=>Promise<void>) {
    if(saving.current)return; saving.current=true;setBusy(true);setError("");
    try{await action();}catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
  }
  const close = () => {if(!busy){setModal(null);setError("");}};
  const open = (m:Modal) => {setAccountMenu(null);if(m==="custom")setEditing(undefined);setError("");setModal(m);};
  const go = (v:View) => {setAccountMenu(null);setView(v);setMobile(false);setError("");};
  function endDemo(){setDraft(undefined);setDemo(false);setState(null);setAccountMenu(null);setMobile(false);setModal(null);setRemoved(null);setEditing(undefined);if(user)void load();}
  function beginDemo() {
    pet.clear();setExecution(null);
    setAccountMenu(null);setRemoved(null);setEditing(undefined);
    const answers:Answers = {...defaultAnswers,basic:{...emptyBasicProfile(),sleepRange:"5-7",exerciseRange:"under60",sittingRange:"over8"},name:"지우",sleepHours:6.5,vegetables:3,fish:1,dairy:2,stress:4,caffeineTime:"16:00",scheduleShiftHours:1,fruitVegGrams:250,legumeDays:2,wholegrainDays:3,processedMeatDays:1,moderateWeeklyMinutes:40,vigorousWeeklyMinutes:0,strengthAllGroups:"no"};
    const next:AppState={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers,schedule:{...defaultSchedule},inbody:[],days:[buildDay(answers,initialCheckin(answers),"core",defaultSchedule)]};
    setDraft(undefined);setDemo(true);setState(next);setView("today");setRevision(0);
  }
  async function makeDay(answers:Answers, checkin:Checkin, mode:"core"|"full", schedule:Schedule, history:Day[], inbody?:Inbody, refresh=true):Promise<Day> {
    if(demo)return buildPlannedDay(answers,checkin,mode,schedule,history,inbody,today,refresh,state?.planner);
    const result=await api("/api/plan",{method:"POST",body:JSON.stringify({answers,checkin,mode,schedule,history,inbody,refresh,planner:state?.planner})});return result.day;
  }
  async function savePlanner(planner:Planner,change?:PlannerChange) {
    if(!state||saving.current)throw new Error("저장이 끝난 뒤 다시 시도해주세요.");
    saving.current=true;setBusy(true);setError("");
    try{
      const oldEvents=scheduleForDate(state.schedule,state.planner,today).events;
      const newEvents=scheduleForDate(state.schedule,planner,today).events;
      const c=day?.checkin??initialCheckin(state.answers);
      const changed=JSON.stringify([oldEvents,scheduleContext(state.schedule,state.planner,today,c)])!==JSON.stringify([newEvents,scheduleContext(state.schedule,planner,today,c)]);
      const history=change?.edit?editSavedBlockPlans(state.days,planner,change.edit,state.schedule):change?.remove?removeSavedBlockPlans(state.days,change.remove):change?.restorePlans?restoreSavedBlockPlans(state.days,change.restorePlans,state.schedule.wake):state.days;
      const d=changed?buildPlannedDay(state.answers,day?.checkin??initialCheckin(state.answers),day?.mode??"core",state.schedule,history,state.inbody.at(-1),today,true,planner):undefined;
      await persist({...state,planner,days:d?[...history.filter(x=>x.date!==today),d].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90):history},change?.edit?"연결된 모든 일정과 보관함의 내용을 수정했어요. 실천 기록은 유지됩니다.":change?.remove?"선택한 일정에서 블록을 제거했어요. 실천 기록은 유지하고 이 화면에서 되돌릴 수 있어요.":change?.restorePlans?"일정 블록을 복원했어요. 최신 실천 기록은 유지됩니다.":changed?"계획을 저장하고 오늘의 미완료 추천 루틴을 조정했어요.":"계획표를 저장했어요.");
    }catch(e){setError((e as Error).message);throw e;}finally{saving.current=false;setBusy(false);}
  }
  function completeOnboarding(answers:Answers) { void perform(async()=>{
    answers={...answers,activities:answers.activities??state?.answers.activities};
    const s=state?.schedule??{...defaultSchedule,wake:answers.wake,bed:answers.bed};
    const d=await makeDay(answers,initialCheckin(answers),"core",s,state?.days??[],state?.inbody.at(-1));
    const next:AppState={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers,schedule:s,planner:state?.planner,nutrition:state?.nutrition,growth:state?.growth,inbody:state?.inbody??[],days:[...(state?.days??[]).filter(x=>x.date!==today),d].slice(-90)};
    await persist(next);setDraft(undefined);setModal(null);setView("today");setToast("기초 정보로 작은 루틴을 준비했어요. 계획표를 작성하면 일정 분석과 루틴 조정이 시작돼요.");
  });}
  function generate(checkin:Checkin,mode:"core"|"full",schedule=state!.schedule,refresh=true) {void perform(async()=>{
    if(!state)return;const d=await makeDay(state.answers,checkin,mode,schedule,state.days,state.inbody.at(-1),refresh);
    await persist({...state,schedule,days:[...state.days.filter(x=>x.date!==today),d].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90)},refresh?"컨디션을 저장하고 오늘 가능한 루틴으로 조정했어요.":"오늘 담은 루틴으로 전체 일정을 배치했어요.");setModal(null);if(!refresh&&mode==="full")setView("planner");else setView("today");
  });}
  async function saveGrowth(growth:NonNullable<AppState["growth"]>){
    if(!state||saving.current)throw new Error("저장이 끝난 뒤 다시 시도해주세요.");
    saving.current=true;setBusy(true);try{await persist({...state,growth},"하루의 기록을 저장했어요.");}finally{saving.current=false;setBusy(false);}
  }
  function saveAnswers(answers:Answers,refine=false){void perform(async()=>{if(!state)return;const schedule=refine&&answers.basic?.focusTime&&answers.basic.focusTime!=="unknown"?{...state.schedule,peak:answers.basic.focusTime}:state.schedule;const d=refine?await makeDay(answers,answers.activities?{...(day?.checkin??initialCheckin(answers)),minutes:answers.available}:day?.checkin??initialCheckin(answers),day?.mode??"core",schedule,state.days,state.inbody.at(-1)):undefined;await persist({...state,answers,schedule,days:d?[...state.days.filter(x=>x.date!==today),d].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90):state.days},refine?"목표와 가능 시간을 반영해 루틴을 조정했어요.":"영양 안내를 위한 확인 정보를 저장했어요.");setModal(null);});}
  async function saveActivityCategory(answers:Answers):Promise<Day>{
    if(!state||saving.current)throw new Error("저장이 끝난 뒤 다시 시도해주세요.");
    saving.current=true;setBusy(true);setError("");
    try{
      const d=await makeDay(answers,{...(day?.checkin??initialCheckin(answers)),minutes:answers.available},day?.mode??"core",state.schedule,state.days,state.inbody.at(-1));
      await persist({...state,answers,days:[...state.days.filter(x=>x.date!==today),d].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90)},"이 분야의 답변과 추천을 저장했어요. 다음 분야는 나중에 이어갈 수 있어요.");
      return d;
    }catch(e){setError((e as Error).message);throw e;}finally{saving.current=false;setBusy(false);}
  }
  async function saveNutrition(nutrition:NutritionProfile){
    if(!state||saving.current)throw new Error("저장 후 다시 시도해주세요.");
    saving.current=true;setBusy(true);setError("");
    try{await persist({...state,nutrition},"음식·섭취 정보를 저장했어요. 선택에 맞춰 안내를 갱신했어요.");}catch(e){setError((e as Error).message);throw e;}finally{saving.current=false;setBusy(false);}
  }
  function setPlanningStyle(planningStyle:"spontaneous"|"planned"){void perform(async()=>{
    if(!state)return;await persist({...state,answers:{...state.answers,planningStyle}},"시작 방식을 바꿨어요. 기존 일정·기록은 유지됩니다.");setView(planningStyle==="planned"?"planner":"today");
  });}
  async function saveDay(next:Day,message:string) {
    if(!state)return;await persist({...state,days:[...state.days.filter(d=>d.date!==today),next].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90)},message);
  }
  function addRoutine(r:Routine){void perform(async()=>{
    if(!state)return;
    const base=day??buildDay(state.answers,initialCheckin(state.answers),"core",resolvedSchedule,state.days,state.inbody.at(-1));
    if(!editing&&base.routines.length>=MAX_DAILY_ROUTINES)throw new Error(`오늘의 루틴은 최대 ${MAX_DAILY_ROUTINES}개까지 담을 수 있어요.`);
    if(!editing&&base.routines.some(x=>x.id===r.id))throw new Error("이미 오늘의 루틴에 담았어요.");
    await saveDay(reviseDayRoutines(base,holdUnsafeRoutines(editing?base.routines.map(x=>x.id===editing.id?r:x):[...base.routines,r],base.checkin,state.answers.movementLimit),resolvedSchedule),editing?"루틴 내용을 수정했어요. 실천 기록은 유지돼요.":"오늘의 루틴에 추가했어요.");setEditing(undefined);setModal(null);
  });}
  function removeRoutine(id:string){void perform(async()=>{
    if(!state||!day)return;const routine=day.routines.find(r=>r.id===id);if(!routine)return;
    await saveDay(reviseDayRoutines(day,day.routines.filter(r=>r.id!==id),resolvedSchedule),"오늘 목록에서 제외했어요. 아래에서 되돌릴 수 있어요.");
    setRemoved({date:today,routine,status:day.statuses[id],note:day.notes[id],feedback:day.activityFeedback?.[id]});
  });}
  function undoRemove(){void perform(async()=>{
    if(!state||!day||!removed||removed.date!==today)return;
    if(day.routines.some(r=>r.id===removed.routine.id)){setRemoved(null);return;}
    const restored={...day,activityFeedback:{...day.activityFeedback,...(removed.feedback?{[removed.routine.id]:removed.feedback}:{})},statuses:{...day.statuses,...(removed.status?{[removed.routine.id]:removed.status}:{})},notes:{...day.notes,...(removed.note?{[removed.routine.id]:removed.note}:{})}};
    await saveDay(reviseDayRoutines(restored,[...day.routines,removed.routine],resolvedSchedule),"루틴과 실천 상태를 되돌렸어요.");setRemoved(null);
  });}
  async function petCommand(command:PetCommand){
    if(saving.current)throw Error("저장이 끝난 뒤 다시 시도해주세요.");saving.current=true;setBusy(true);setError("");
    try{await pet.mutate(command);setToast(command.action==="adopt"?"새 친구가 오늘의 루틴에 찾아왔어요!":"실제 수행과 사모예드 상태를 저장했어요.");}catch(e){setError((e as Error).message);throw e;}finally{saving.current=false;setBusy(false);}
  }
  function editExecution(record:PetExecution){const source=record.sources[0];setExecution({source,title:record.title,type:record.type,minutes:Math.round((Date.parse(record.end)-Date.parse(record.start))/60000),existing:record,...(source.kind==="sleep"?{fixedSleep:true,start:record.start,end:record.end}:{})});}
  function routineExecution(routine:Routine,value:"done"|"partial"="done"){
    const source={kind:"routine" as const,id:routine.id,date:today},existing=executionFor(pet.result?.document,source);
    setExecution({source,title:routine.title,type:routineEffect(routine,state!.answers),minutes:day?.activityFeedback?.[routine.id]?.actualMinutes??routine.activity?.goalMinutes??routine.minutes??10,status:value,existing});
  }
  async function plannerExecution(block:PlannerBlock,date:string,value:"done"|"partial"|"skipped"){
    const source={kind:"planner" as const,id:block.id,date},existing=executionFor(pet.result?.document,source);
    if(value==="skipped"&&!existing){await savePlanner(recordOccurrence(state!.planner!,block,date,value,today));return;}
    setExecution({source,title:block.title,type:blockEffect(block),minutes:Math.max(1,((Number(block.end.slice(0,2))*60+Number(block.end.slice(3)))-(Number(block.start.slice(0,2))*60+Number(block.start.slice(3)))+1440)%1440),status:value==="partial"?"partial":"done",existing,end:date<today?new Date(`${date}T${block.end}:00+09:00`).toISOString():undefined});
  }
  function sleepExecution(bed:SleepRecord,wake:SleepRecord){const source={kind:"sleep" as const,id:bed.sessionDate,date:bed.sessionDate};setExecution({source,title:"실제 수면 기록",type:"sleep",minutes:Math.round((Date.parse(wake.actualAt!)-Date.parse(bed.actualAt!))/60000),start:bed.actualAt!,end:wake.actualAt!,fixedSleep:true,existing:executionFor(pet.result?.document,source)});}
  async function savePendingExecution(draft:ExecutionDraft){
    if(saving.current||!state)throw Error("저장이 끝난 뒤 다시 시도해주세요.");
    if(draft.source.kind==="planner"&&state.planner){const block=state.planner.blocks.find(b=>b.id===draft.source.id);if(block)await savePlanner(recordOccurrence(state.planner,block,draft.source.date,draft.status??"done",today));return;}
    if(draft.source.kind==="routine"&&day){saving.current=true;setBusy(true);try{await saveDay({...day,statuses:{...day.statuses,[draft.source.id]:draft.status??"done"}},"완료 체크만 저장했어요. 실제 시간 확인 후 강아지에 반영할 수 있어요.");}finally{saving.current=false;setBusy(false);}}
  }
  function status(id:string,value:"done"|"partial"|"skipped") {
    if(pet.result?.document&&state&&day){const r=day.routines.find(r=>r.id===id);if(r&&!r.held&&(value!=="skipped"||executionFor(pet.result.document,{kind:"routine",id,date:today}))){routineExecution(r,value==="partial"?"partial":"done");return;}}
    legacyStatus(id,value);
  }
  function legacyStatus(id:string,value:"done"|"partial"|"skipped") {void perform(async()=>{
    if(!state||!day)return;const routine=day.routines.find(r=>r.id===id);if(routine?.held&&day.statuses[id]!==value)throw new Error("이 활동은 오늘 보류 중이에요. 몸 상태를 다시 확인해주세요.");const statuses={...day.statuses};if(statuses[id]===value)delete statuses[id];else statuses[id]=value;
    await persist({...state,days:state.days.map(d=>d.date===today?{...d,statuses}:d)});
  });}
  function addInbody(record:Inbody){void perform(async()=>{
    if(!state)return;await persist({...state,inbody:[...state.inbody,record].sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)).slice(-30)},"확인한 InBody 수치를 기록했어요. 운동 강도·식단 처방에는 사용하지 않아요.");setModal(null);
  });}
  async function exportData(){await perform(async()=>{
    if(!state)return;let sleepArchive:unknown;
    if(!demo){const response=await fetch("/api/sleep");if(!response.ok)throw Error("수면 기록까지 포함해 내보내지 못했어요. 잠시 후 다시 시도해주세요.");const data=await response.json();sleepArchive={profile:data.profile,records:data.records};}
    let petArchive=pet.result?.document;if(!demo){const response=await fetch("/api/pet",{cache:"no-store"});if(!response.ok)throw Error("강아지 기록까지 포함해 내보내지 못했어요.");petArchive=(await response.json()).document;}
    const url=URL.createObjectURL(new Blob([JSON.stringify({...state,...(sleepArchive?{sleepArchive}:{}),petArchive},null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download=`routine-fit-${today}.json`;link.click();URL.revokeObjectURL(url);setToast("내 데이터를 내려받았어요. 생활·건강정보가 포함되어 있으니 안전하게 보관해주세요.");
  });}
  function resetData(){void perform(async()=>{
    if(demo){beginDemo();setModal(null);setToast("체험 데이터만 초기화했어요. 계정에 저장된 데이터는 유지돼요.");return;}
    await api("/api/state",{method:"DELETE"});
    setDraft(undefined);setRemoved(null);setEditing(undefined);setState(null);setRevision(0);setAccountMenu(null);setMobile(false);setView("today");setModal("onboard");setToast("내 데이터를 초기화했어요. 로그인 계정은 유지되며 첫 질문부터 다시 시작할 수 있어요.");
  });}

  if(loading)return <div className="loading-screen"><Brand/><LoaderCircle className="spin"/><p>나의 루틴을 불러오고 있어요.</p></div>;
  if(loadError)return <div className="loading-screen"><Brand/><p role="alert">{loadError}</p><button className="button primary" onClick={load}>다시 불러오기</button><AccountSignOut className="text-link">로그아웃</AccountSignOut></div>;
  if(!state)return <><Landing user={user} onStart={()=>open("onboard")} onDemo={beginDemo}/>{toast&&<div className="toast" role="status"><CheckCheck size={18}/>{toast}</div>}<section className="import-banner"><strong>기존 ROUTINE FIT 기록이 있나요?</strong><p>기존 사이트에서 내려받은 JSON 파일로 루틴·일정·InBody 수치를 이어갈 수 있어요.</p><a className="button secondary" href="/import">기존 데이터 가져오기<Upload size={16}/></a></section>{modal==="onboard"&&<Onboarding draft={draft} onDraft={setDraft} busy={busy} error={error} onComplete={completeOnboarding} onClose={close}/>}</>;

  const done=day?.routines.filter(r=>day.statuses[r.id]==="done").length??0;
  const total=day?.routines.filter(r=>!r.held||day.statuses[r.id]==="done").length??0;
  const progress=total?Math.round(done/total*100):0;
  const scores=analyze(state.answers);
  return <div className="app-shell">
    <aside className={`sidebar ${mobile?"open":""}`}>
      <div className="sidebar-brand"><Brand/><button className="mobile-close icon-button" aria-label="메뉴 닫기" onClick={()=>setMobile(false)}><X size={20}/></button></div>
      <div className="workspace-label">MY GROWTH SPACE</div>
      <nav aria-label="주 메뉴">{nav.map(({id,label,icon:Icon})=><button key={id} className={`nav-item ${view===id?"active":""}`} onClick={()=>go(id)}><Icon size={19}/><span>{label}</span>{id==="today"&&total>0&&<small>{done}/{total}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={19}/></span><b>작게 시작해도 괜찮아요</b><p>나에게 맞는 속도로,<br/>꾸준히 이어가는 작은 습관.</p><button onClick={()=>open("info")}>ROUTINE FIT 알아보기 <ArrowUpRight size={14}/></button></div>
      <button className={`nav-item ${view==="settings"?"active":""}`} onClick={()=>go("settings")}><Settings size={19}/>설정</button>
      <div className="sidebar-profile"><ProfileMenu name={a!.name} email={user?.email} placement="sidebar" open={accountMenu==="sidebar"} busy={busy} demo={demo} onOpenChange={open=>setAccountMenu(open?"sidebar":null)} onSettings={()=>go("settings")} onProfile={()=>open("onboard")} onExport={()=>void exportData()} onReset={()=>open("delete")} onExitDemo={endDemo}/></div></div>
    </aside>
    {mobile&&<button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={()=>setMobile(false)}/>}
    <div className="app-main"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="메뉴 열기" onClick={()=>setMobile(true)}><Menu size={21}/></button><span>나의 성장 기록</span><ChevronRight size={13}/><b>{nav.find(n=>n.id===view)?.label??"설정"}</b></div><div className="top-actions"><span className="storage-status"><span/>{demo?"예시 · 서버 미저장":busy?"저장 중…":"계정에 저장됨"}</span><button className="icon-button" aria-label="서비스 안내" onClick={()=>open("info")}><CircleHelp size={19}/></button><ProfileMenu name={a!.name} email={user?.email} placement="header" open={accountMenu==="header"} busy={busy} demo={demo} onOpenChange={open=>setAccountMenu(open?"header":null)} onSettings={()=>go("settings")} onProfile={()=>open("onboard")} onExport={()=>void exportData()} onReset={()=>open("delete")} onExitDemo={endDemo}/></div></header>
    <main className="content" ref={contentRef}>
      {demo&&<div className="demo-banner"><span><Sparkles size={16}/>예시 데이터로 체험 중이에요. 변경 내용은 서버에 저장되지 않아요.</span>{user?<button onClick={()=>{setDraft(undefined);setDemo(false);setState(null);open("onboard");}}>내 정보로 시작 <ArrowRight size={14}/></button>:<a href="/sign-in">로그인하고 시작 <ArrowRight size={14}/></a>}</div>}
      <div className="page-heading"><div><div className="eyebrow">{view==="today"?"A LITTLE BETTER, EVERY DAY":"YOUR DAILY GROWTH COMPANION"}</div><h1>{titles[view].title}</h1><p>{titles[view].subtitle}</p></div><div className="date-wrap"><button className="date-chip" onClick={()=>setShowDates(v=>!v)} aria-expanded={showDates}><CalendarDays size={16}/>{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric",weekday:"short"}).format(new Date())}</button>{showDates&&<div className="date-note">모든 기록은 한국 시간 기준이에요.<br/>이전 날짜의 실천은 주간 리포트에서 확인해요.</div>}</div></div>
      {error&&!modal&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError("")} aria-label="오류 닫기"><X size={16}/></button></div>}

      {view==="settings"&&<div className="panel style-settings"><PlanningStyleChoice value={a!.planningStyle} busy={busy} onChange={setPlanningStyle}/></div>}{view==="today"&&!a!.planningStyle&&<details className="panel style-settings"><summary>하루를 시작하는 방식 선택 (선택)</summary><PlanningStyleChoice value={a!.planningStyle} busy={busy} onChange={setPlanningStyle}/></details>}
      {view==="today"&&<>
        
        <div className="overview-grid"><PetHome pet={pet.result} busy={busy} loading={pet.loading} error={pet.error} onCommand={petCommand} onRecord={setExecution} onCheckin={()=>open("checkin")} onSettings={()=>go("settings")}/>
        <Panel className="progress-panel"><div className="small-head"><h3>오늘의 실천</h3><span className="muted">DAILY PROGRESS</span></div><div className="progress-ring" style={{"--progress":`${progress}%`} as React.CSSProperties}><div><strong>{progress}<small>%</small></strong><span>{done===total&&total?"오늘도 잘했어요!":"나의 속도로 차근차근"}</span></div></div><div className="progress-bottom"><span><b>{String(done).padStart(2,"0")}</b> 완료</span><i/><span><b>{String(total-done).padStart(2,"0")}</b> 남은 루틴</span></div></Panel></div>
        <ActivityGoals state={state} busy={busy} onRefine={()=>open("refine")} onPlan={()=>go("planner")}/>
        {pet.result?.document&&<PetHistory pet={pet.result} busy={busy} onEdit={editExecution} onCommand={petCommand}/>}
        <div className="dashboard-grid"><div><SectionHead label="TODAY’S SMALL STEPS" title="오늘, 이것만 해볼까요?" action={<div className="routine-heading-actions"><Badge color="neutral">나의 핵심 루틴</Badge><button className="button secondary" onClick={()=>open("custom")} disabled={busy}><Plus size={15}/>직접 루틴 만들기</button></div>}/>
        {day?.planningContext&&<div className="sp-routine-context"><span><CalendarDays size={16}/> {day.planningContext.date} 하루 계획의 일정 {day.planningContext.importedIds.length}개 반영 · 정신적 부담 {day.planningContext.mental}/5 · 육체적 피로 {day.planningContext.physical}/5 · 추천 시간 {day.planningContext.effectiveMinutes}분 이내</span><button className="text-link" onClick={()=>go("planner")}>계획표 보기</button></div>}
        {day&&<><div className="routine-day-context"><span><Sparkles size={15}/>{conditionSummary(day.checkin)}</span><b>남은 실천 {day.routines.filter(r=>!r.held&&day.statuses[r.id]!=="done").reduce((n,r)=>n+r.minutes,0)}분 · {day.routines.length}개</b></div>{day.warnings.map(w=><div className="note routine-warning" key={w}>{w}</div>)}</>}
        {removed?.date===today&&<div className="routine-undo" role="status"><span>“{removed.routine.title}”를 목록에서 제외했어요.</span><button className="text-link" disabled={busy} onClick={undoRemove}>되돌리기</button></div>}
        {day?<div className="routine-list">{day.routines.map((r,index)=>{const Icon=icons[r.category];const s=day.statuses[r.id];return <article className={`routine-card ${s==="done"?"completed":""}`} key={r.id}><button className="routine-check" disabled={busy||(r.held&&s!=="done")} aria-label={`${r.title} ${s==="done"?"완료 취소":"완료"}`} aria-pressed={s==="done"} onClick={()=>status(r.id,"done")}>{s==="done"?<Check size={18}/>:<span>{String(index+1).padStart(2,"0")}</span>}</button><div className="routine-icon" data-category={r.category}><Icon size={21}/></div><div className="routine-copy"><div><span className="category-label">{categoryLabels[r.category]}</span><span className="routine-when">{r.when}</span><span className={`routine-source ${r.source??"auto"}`}>{routineSourceLabel(r)}</span></div><h3>{r.title}</h3>{r.held&&<p className="hold-notice" role="status">오늘은 보류 · 이전 실천 기록은 유지해요. 몸 상태를 확인하기 전에는 활동하지 마세요.</p>}<p>{r.detail}</p><RoutineGuidance guide={guidanceForRoutine(r,state.answers,state.nutrition??null)}/><RoutineSources routine={r}/><details><summary>추천 이유와 쉬운 대안</summary><p>{r.reason}</p><p><b>시간이 없다면</b> {r.fallback}</p></details><div className="routine-secondary"><button disabled={busy||(r.held&&s!=="partial")} className={s==="partial"?"selected":""} onClick={()=>status(r.id,"partial")}>조금 했어요</button><button disabled={busy||(r.held&&s!=="skipped")} className={s==="skipped"?"selected":""} onClick={()=>status(r.id,"skipped")}>오늘은 어려워요</button></div>{pet.result?.document&&s&&s!=="skipped"&&<div className="pet-record-tag"><span>{executionFor(pet.result.document,{kind:"routine",id:r.id,date:today})?"사모예드에 반영됨":"체크만 저장됨 · 성장 반영 대기"}</span><button className="text-link" disabled={busy||r.held} onClick={()=>routineExecution(r,s==="partial"?"partial":"done")}>실제 시간 확인·수정</button></div>}{r.activity&&s&&!executionFor(pet.result?.document,{kind:"routine",id:r.id,date:today})&&<ActivityFeedbackForm key={`${r.id}-${day.activityFeedback?.[r.id]?.recordedAt??"empty"}`} routine={r} initial={day.activityFeedback?.[r.id]} busy={busy} onSave={async feedback=>{if(saving.current)throw new Error("저장이 끝난 뒤 다시 시도해주세요.");saving.current=true;setBusy(true);try{await saveDay({...day,activityFeedback:{...day.activityFeedback,[r.id]:feedback}},"실제 시간과 피드백을 저장했어요. 주간 목표는 유지돼요.");}finally{saving.current=false;setBusy(false);}}}/>}{s==="skipped"&&<Select label="어려웠던 이유 (선택)" value={day.notes[r.id]??""} options={{"":"선택하지 않음",time:"시간 부족",tired:"피곤함",forgot:"잊었어요",pain:"몸이 불편함",schedule:"일정 변경",unsuitable:"루틴이 맞지 않음"}} onChange={reason=>void perform(async()=>{await saveDay({...day,notes:{...day.notes,[r.id]:reason}},"다음 계획을 위해 이유를 기록했어요.");})}/>}</div><div className="routine-card-tools"><button className="text-link" disabled={busy} onClick={()=>{setEditing(r);setError("");setModal("custom");}}>수정</button><span className="duration"><Clock3 size={13}/>{r.minutes}분</span><button className="icon-button routine-remove" disabled={busy} onClick={()=>removeRoutine(r.id)} aria-label={`${r.title} 오늘 목록에서 제외`} title="오늘 목록에서 제외"><X size={15}/></button></div></article>;})}</div>:<Panel><Empty icon={Sun} title="오늘의 첫 체크인을 기다려요" action={<button className="button primary" onClick={()=>open("checkin")}>오늘 루틴 만들기</button>}>어제와 다른 오늘의 상태를 알려주세요.</Empty></Panel>}
        {day&&<RoutineBuilder nutrition={state.nutrition} answers={state.answers} day={day} inbody={state.inbody.at(-1)} busy={busy} onAdd={addRoutine}/>}
        <div className="planner-invite"><div className="planner-invite-icon"><CalendarDays size={24}/></div><div><h3>주간 일정부터 하루 계획까지</h3><p>고정 시간표를 만들고, 날짜별 일정에 맞춰 루틴을 추천받아요.</p></div><button className="button secondary" onClick={()=>go("planner")}>주간·하루 계획 만들기<ArrowUpRight size={16}/></button></div></div>
        <aside className="dashboard-aside"><DailyWords key={today} date={today} growth={state.growth} busy={busy} onSave={saveGrowth}/><Panel><SectionHead title="나의 계획과 기록"/><p className="panel-caption">예정 일정과 실제 수행을 구분해요.</p><div className="balance-list"><p>{state.planner?.blocks.length?"계획표가 등록되어 있어요. 작성한 날짜의 시간 배분을 살펴보세요.":"계획표를 작성하면 생활패턴 분석이 시작돼요."}</p><p>기록한 루틴 {state.days.filter(d=>Object.keys(d.statuses).length>0).length}일</p></div><button className="text-link" onClick={()=>go("analysis")}>생활패턴 분석 보기<ArrowRight size={14}/></button></Panel><Panel><Badge color="neutral">NEXT STEP</Badge><h3>필요할 때 한 단계 더</h3><p>관심 분야·하루 및 주간 목표로 활동까지 구체화해요. 수면·영양 정보는 선택해서 사용할 수 있어요.</p><button className="text-link" onClick={()=>open("refine")}>루틴 구체화</button><button className="text-link" onClick={()=>go("sleep")}>수면 체크인</button><button className="text-link" onClick={()=>go("supplements")}>현재 영양제 정보</button></Panel></aside></div>
      </>}
      {view==="planner"&&<><div className="growth-start-note"><Sparkles size={18}/><div><b>계획표에서 관심 활동까지 구체화해요</b><p>일정을 등록한 뒤 하루·주간 목표와 선호를 알려주세요. 선택한 활동만 추가 질문해요.</p></div><button className="button secondary" disabled={busy} onClick={()=>open("refine")}>활동에 맞춘 루틴 구체화</button></div><ScheduleWorkspace state={state} busy={busy} onRecord={pet.result?.document?plannerExecution:undefined} onSave={savePlanner} onGenerate={()=>generate(day?.checkin??initialCheckin(a!),"core",state.schedule,true)} onSettings={()=>open("schedule")}/><details className="sp-generated" open={day?.mode==="full"}><summary>작은 실천까지 배치한 오늘의 전체 타임라인</summary><SectionHead label="MY DAY, MY PACE" title="오늘의 타임라인" action={<button className="button primary" onClick={()=>open("schedule")}><Plus size={16}/>일정 입력·계획 생성</button>}/>{day?.mode==="full"&&day.timeline.length?<Panel className="timeline-panel"><div className="timeline-legend"><Badge color="neutral">고정 일정</Badge><Badge>추천 루틴</Badge><Badge color="green">식사·휴식</Badge><span>일정 사이 {state.schedule.buffer}분의 여유 확보</span></div>{day.warnings.length>0&&<p className="hold-notice">일부 항목 배치 미완료 · 아래 내용을 확인하고 일정을 조정해주세요.</p>}{day.warnings.map(w=><div className="note" key={w}>{w}</div>)}<div className="timeline">{day.timeline.filter(t=>!t.routineId||!day.routines.find(r=>r.id===t.routineId)?.held).map(t=><TimelineRow routine={day.routines.find(r=>r.id===t.routineId)} key={t.id} item={t} done={!!t.routineId&&day.statuses[t.routineId]==="done"} onDone={()=>t.routineId&&status(t.routineId,"done")} busy={busy}/>)}</div><div className="timeline-end"><Moon size={18}/>{state.schedule.bed} · 취침</div></Panel>:<Panel><Empty icon={CalendarDays} title="나의 하루에 맞춘 계획을 만들어보세요" action={<button className="button primary" onClick={()=>open("schedule")}>고정 일정 등록하기<ArrowRight size={16}/></button>}>기상·식사·출퇴근과 고정 일정을 알려주면,<br/>시간이 겹치지 않도록 루틴을 배치해요.</Empty></Panel>}</details></>}
      {view==="analysis"&&<><GrowthAnalysis state={state} onPlan={()=>go("planner")} onRefine={()=>open("refine")}/>{a!.basic?.origin==="legacy"&&<details className="panel"><summary>기존 상세 건강 설문 분석 보기</summary><LifestyleAnalysis answers={{...a!,basic:undefined}} onEdit={()=>open("onboard")}/></details>}</>}
      {view==="sleep"&&<SleepWorkspace demo={demo} initialBed={state.schedule.bed} initialWake={state.schedule.wake} onPetRecord={pet.result?.document?sleepExecution:undefined} onRecordsChange={pet.updateSleep}/> }
      {view==="supplements"&&<><div className="nutrition-return"><button className="button secondary" onClick={()=>go("today")}>오늘의 루틴 보기<ArrowRight size={15}/></button><button className="text-link" onClick={()=>open("checkin")}>오늘 컨디션 수정</button></div><NutritionGuide key={demo?"demo-nutrition":"account-nutrition"} state={state} busy={busy} onSave={saveNutrition} onEdit={()=>open("safety")}/></>}
      {view==="report"&&<><Report state={state} onCheckin={()=>open("checkin")}/>{pet.result?.document&&<PetHistory pet={pet.result} busy={busy} onEdit={editExecution} onCommand={petCommand}/>}</>}
      {view==="inbody"&&<><SectionHead label="OPTIONAL BODY INSIGHTS" title="나의 체성분 기록" action={<button className="button primary" onClick={()=>open("inbody")}><Plus size={16}/>InBody 등록</button>}/>{state.inbody.length?<><div className="inbody-summary">{[{label:"최근 체중",value:state.inbody.at(-1)!.weight,unit:"kg"},{label:"골격근량",value:state.inbody.at(-1)!.muscle,unit:"kg"},{label:"체지방률",value:state.inbody.at(-1)!.fat,unit:"%"}].map(m=><Panel key={m.label}><p>{m.label}</p><strong>{m.value}<small>{m.unit}</small></strong><span>{state.inbody.at(-1)!.measuredAt} 측정</span></Panel>)}</div><Panel><div className="record-table"><table><thead><tr><th>측정일</th><th>체중</th><th>골격근량</th><th>체지방률</th><th>관리</th></tr></thead><tbody>{[...state.inbody].reverse().map((r,i)=><tr key={`${r.measuredAt}-${i}`}><td>{r.measuredAt}</td><td>{r.weight} kg</td><td>{r.muscle} kg</td><td>{r.fat}%</td><td><button className="icon-button" disabled={busy} aria-label={`${r.measuredAt} 기록 삭제`} onClick={()=>void perform(()=>persist({...state,inbody:state.inbody.filter((_,idx)=>idx!==state.inbody.length-1-i)},"체성분 기록을 삭제했어요."))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></Panel></>:<Panel><Empty icon={ScanLine} title="InBody가 없어도 루틴은 충분해요" action={<button className="button secondary" onClick={()=>open("inbody")}><Upload size={16}/>결과지 등록하기</button>}>최근 결과지가 있다면 선택적으로 등록해보세요.<br/>숫자를 직접 입력하거나 이미지 자동 인식을 시도할 수 있어요.</Empty></Panel>}<div className="note">체성분은 측정 조건에 따라 달라질 수 있어요. 같은 조건의 추이를 참고하며, InBody만으로 영양소 결핍을 추정하지 않습니다.</div></>}
      {view==="settings"&&<div className="settings-grid"><PetSettings key={pet.result?.document?.lifecycleId??"not-adopted"} pet={pet.result} busy={busy} onCommand={petCommand}/><Panel><h2>나의 프로필</h2><div className="profile-summary"><div className="avatar large">{a!.name.slice(0,1)}</div><div><h3>{a!.name}</h3><p>{goalLabels[a!.goal]} · 하루 {a!.available}분</p><small>{demo?"예시 체험 계정":user?.email}</small></div></div><button className="button secondary" onClick={()=>open("onboard")}>기초 질문 수정<ArrowRight size={16}/></button></Panel><Panel><h2>건강정보 관리</h2><p>동의일: {state.consentAt.slice(0,10)} · 동의 버전 {state.consentVersion}</p><p>최근 90일 계획·회고와 최대 30건의 InBody 수치를 계정에 저장해요. 수면 기록과 강아지의 실제 수행·성장 기록도 내려받기·전체 삭제에 포함됩니다. 원본 이미지는 저장하지 않아요.</p><div className="settings-actions"><button className="button secondary" onClick={exportData}><Download size={16}/>내 데이터 내려받기</button><a className="button secondary" href="/import"><Upload size={16}/>이전 데이터 가져오기 안내</a><button className="button danger" onClick={()=>open("delete")}><Trash2 size={16}/>내 데이터 초기화</button></div></Panel><Panel><h2>추천을 더 나에게 맞게</h2><p>관심 분야·하루 및 주간 목표·활동·환경을 선택해 구체적인 루틴을 만들어요.</p><button className="button secondary" onClick={()=>open("refine")}>선택 질문 진행</button></Panel><Panel className="form-span"><h2>서비스 제공 범위</h2><p>루틴 추천과 영양성분 안내는 일반적인 건강관리 참고 정보입니다. 설문으로 질병이나 영양소 결핍을 진단하지 않습니다. 영양제는 식사와 처방약을 대신하지 않습니다.</p><p>성분의 역할·기대 효과·한계와 식단·단일·복합 제품 유형을 규칙 기반으로 안내해요. 전체 약물 상호작용이나 실제 상품 라벨은 자동 검사하지 않으며, 위험·불확실한 정보가 있으면 제품 연결을 보류합니다.</p><p>iHerb 연결은 검색 페이지 이동 기능입니다. 제휴 API·실시간 가격·재고·자동 결제는 연결되어 있지 않습니다.</p></Panel></div>}
      <footer className="app-footer"><span>ROUTINE FIT <i/>Small steps. Better days.</span><span>자기개발·일상관리를 위한 참고 정보 · 의료적 진단 및 처방이 아닙니다.</span></footer>
    </main></div>
    {execution&&pet.result?.document&&<ExecutionConfirmDialog key={`${execution.existing?.id??execution.source.id}-${execution.source.date}`} draft={execution} document={pet.result.document} busy={busy} onSave={petCommand} onClose={()=>setExecution(null)} onLater={!execution.existing&&execution.source.kind!=="manual"&&execution.source.kind!=="sleep"?()=>savePendingExecution(execution):undefined}/>}
    {toast&&<div className="toast" role="status"><CheckCheck size={18}/>{toast}</div>}
    {modal==="onboard"&&<Onboarding initial={a} draft={draft} onDraft={setDraft} busy={busy} error={error} onComplete={completeOnboarding} onClose={close}/>}
    {modal==="refine"&&<ActivityWizard state={state} onResultsClose={()=>{close();go("today");}} onPlan={()=>{close();go("planner");}} busy={busy} error={error} onComplete={saveActivityCategory} onClose={close}/>}
    {modal==="safety"&&<SafetySurvey initial={a!} busy={busy} error={error} onComplete={answers=>saveAnswers(answers)} onClose={close}/>}
    {modal==="checkin"&&<DailyCheckin style={a!.planningStyle} hasActivities={!!a!.activities?.profiles.some(p=>p.enabled)} onPlan={()=>{close();go("planner");}} initial={day?.checkin??initialCheckin(a!)} busy={busy} error={error} preview={c=>buildPlannedDay(a!,c,day?.mode??"core",state.schedule,state.days,state.inbody.at(-1),today,true,state.planner)} onSubmit={c=>generate(c,day?.mode??"core")} onClose={close}/>}
    {modal==="custom"&&<CustomRoutineDialog initial={editing} busy={busy} error={error} onSubmit={addRoutine} onClose={close}/>}
    {modal==="schedule"&&<ScheduleForm initial={state.schedule} busy={busy} error={error} onSubmit={s=>generate(day?.checkin??initialCheckin(a!),"full",s,false)} onClose={close}/>}
    {modal==="inbody"&&<InbodyForm demo={demo} busy={busy} error={error} onSubmit={addInbody} onClose={close}/>}
    {modal==="delete"&&<ResetDataDialog demo={demo} busy={busy} error={error} onClose={close} onExport={()=>void exportData()} onConfirm={resetData}/>}
    {modal==="info"&&<Dialog title="나를 위한 가장 작은 시작" subtitle="ROUTINE FIT · 일정·컨디션 기반 자기개발 루틴" onClose={close}><div className="info-values">{[["NOW","오늘 할 수 있는 작은 행동"],["FIT","나의 생활과 목표에 맞춘 제안"],["SAFE","주의가 필요한 상황 먼저 확인"],["SHOP","영양성분을 이해하고 선택"],["LOOP","기록으로 다음 계획 조정"]].map(([title,desc])=><div key={title}><b>{title}</b><span>{desc}</span></div>)}</div><p className="muted">기초 질문 → 기본 루틴 → 계획표 작성 → 생활패턴 분석 → 실천 기록 → 다음 루틴 조정</p><button className="button primary" onClick={close}>내 루틴 이어가기<ArrowRight size={16}/></button></Dialog>}
  </div>;
}

function Brand(){return <a className="brand" href="/" aria-label="ROUTINE FIT 홈"><img src="/mark.svg" width="33" height="33" alt=""/><span>ROUTINE<span>FIT</span><small>내 일상에 맞는 작은 성장</small></span></a>;}
function WellnessArt(){return <div className="wellness-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-orbit orbit-three"/><div className="art-core"><Heart size={43} strokeWidth={1.8}/></div><div className="art-float art-moon"><Moon size={24}/></div><div className="art-float art-leaf"><Leaf size={24}/></div><div className="art-float art-move"><Activity size={25}/></div><span className="art-dot dot-one"/><span className="art-dot dot-two"/><span className="art-spark">✦</span></div>;}
function Landing({user,onStart,onDemo}:{user:{name:string;email:string}|null;onStart:()=>void;onDemo:()=>void}){
 return <div className="landing"><header className="landing-header"><Brand/><div><span className="landing-header-note">오늘의 작은 실천, 나다운 성장</span>{user?<button className="button secondary" onClick={onStart}>내 루틴 만들기<ArrowRight size={15}/></button>:<a className="button secondary" href="/sign-in">로그인<ArrowUpRight size={15}/></a>}</div></header><main><div className="landing-hero"><div><Badge><Sparkles size={13}/>YOUR DAILY GROWTH COMPANION</Badge><h1>바쁜 하루에도,<br/>성장은 <em>나답게.</em></h1><p>공부·독서·생활 정리부터 휴식까지.<br/>몇 가지 질문으로 오늘 실천할 루틴을 만나보세요.</p><div className="landing-actions">{user?<button className="button primary" onClick={onStart}>나에게 맞는 루틴 시작<ArrowRight size={18}/></button>:<a className="button primary" href="/sign-in">로그인하고 시작하기<ArrowRight size={18}/></a>}<button className="button secondary" onClick={onDemo}>먼저 체험해보기<ArrowUpRight size={16}/></button></div><div className="landing-trust"><ShieldCheck size={15}/>짧은 기초 질문 · 기본 루틴 즉시 제공 · 계획표로 정밀화</div></div><div className="landing-visual"><WellnessArt/><div className="floating-task task-one"><span className="routine-icon" data-category="move"><Dumbbell size={20}/></span><div><small>오늘의 작은 실천</small><b>점심 먹고, 10분 산책</b></div><span className="task-tick"><Check size={16}/></span></div><div className="floating-task task-two"><span className="routine-icon" data-category="sleep"><Moon size={20}/></span><div><small>나에게 맞춘 작은 루틴</small><b>하루를 편안하게 마무리</b></div></div><span className="visual-caption">SMALL STEPS. BETTER DAYS.</span></div></div><section className="landing-flow"><div><span className="eyebrow">HOW IT FITS YOUR DAY</span><h2>질문에서 시작해, 기록으로 나에게 맞게</h2></div><div className="landing-steps">{[["01","나를 알아가는 질문","이름·수면·운동 등 최소 정보"],["02","내 삶에 맞는 계획","핵심 루틴 또는 하루 전체 계획"],["03","기록하며 조금씩 개선","실행 체크와 주간 리포트"]].map(([n,title,desc])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section><p className="landing-disclaimer">일정·실천 기록 기반 자기개발과 선택적 건강·영양정보를 제공하는 서비스입니다. 의료적 진단·처방을 제공하지 않습니다.</p></main><footer className="landing-footer"><Brand/><span>Small steps for your own growth.</span></footer></div>;
}


function TimelineRow({item,done,onDone,busy,routine}:{item:TimelineItem;done:boolean;onDone:()=>void;busy:boolean;routine?:Routine}){
 return <div className={`timeline-row ${item.kind} ${done?"is-done":""}`}><div className="timeline-time"><b>{item.start}</b><span>{item.end}</span></div><div className="timeline-marker"><i/></div><div className="timeline-card"><div><Badge color={item.kind==="fixed"?"neutral":item.kind==="routine"?"coral":"green"}>{item.kind==="fixed"?"고정 일정":item.kind==="routine"?"추천 루틴":item.kind==="meal"?"식사":"휴식"}</Badge><h3>{item.title}</h3><p>{item.detail}</p>{routine&&<RoutineSources routine={routine}/>}</div>{item.routineId&&<button className={`routine-check ${done?"checked":""}`} disabled={busy} aria-label={`${item.title} 완료`} aria-pressed={done} onClick={onDone}>{done?<Check size={18}/>:<Check size={18}/>}</button>}</div></div>;
}

function ScheduleForm({initial,busy,error,onSubmit,onClose}:{initial:Schedule;busy:boolean;error:string;onSubmit:(s:Schedule)=>void;onClose:()=>void}) {
  const[s,set]=useState<Schedule>(initial),[localError,setLocalError]=useState("");
  const [event,setEvent]=useState({title:"",start:"09:00",end:"18:00",breakStart:"",breakEnd:""});
  const time=(key:"wake"|"bed"|"breakfast"|"lunch"|"dinner",label:string)=><Input key={key} type="time" label={label} value={s[key]} required onChange={v=>set({...s,[key]:v})}/>;
  const submit=()=>{const issues=[...validateSchedule(s),...buildTimeline([],s).warnings];if(issues.length){setLocalError(issues.join("\n"));return;}setLocalError("");onSubmit(s);};
  return <Dialog title="내 하루의 빈칸에 건강 더하기" subtitle="일정이 겹치면 알려드려요. 고정 일정을 먼저 입력해주세요." onClose={onClose} wide><form onSubmit={e=>{e.preventDefault();submit();}}><div className="form-grid">{time("wake","기상시간")}{time("bed","취침시간")}{time("breakfast","아침식사 희망시간")}{time("lunch","점심식사 희망시간")}{time("dinner","저녁식사 희망시간")}<Input type="number" label="편도 이동시간 (분)" value={s.commute} min={0} max={180} onChange={v=>set({...s,commute:Number(v)})}/><Input type="number" label="아침 준비시간 (분)" value={s.preparation} min={0} max={120} onChange={v=>set({...s,preparation:Number(v)})}/><Select label="추천 활동 선호" value={s.exercise} options={{walk:"가벼운 걷기",stretch:"가벼운 스트레칭"}} onChange={v=>set({...s,exercise:v as Schedule["exercise"]})}/><Select label="집중이 잘되는 시간" value={s.peak} options={{morning:"오전",afternoon:"오후",evening:"저녁"}} onChange={v=>set({...s,peak:v as Schedule["peak"]})}/><Input type="number" label="일정 사이 여유시간 (분)" hint="추가 루틴을 넣을 때 이 간격을 확보해요." value={s.buffer} min={5} max={30} onChange={v=>set({...s,buffer:Number(v)})}/><div className="form-span"><Toggle label="집에서 간단한 식사 준비가 가능해요" checked={s.cooking} onChange={cooking=>set({...s,cooking})}/></div></div>
  <div className="fixed-events"><h3>변경할 수 없는 고정 일정</h3><p className="muted">출근·수업·회의·가족 돌봄 등을 입력하세요. 최대 20개까지 등록할 수 있어요. 종료가 시작보다 이르면 다음 날 종료로 처리해요. 업무 중 식사가 가능하면 쉬는 시간도 입력하세요.</p>{s.events.map(e=><div className="fixed-event" key={e.id}><Clock3 size={16}/><b>{e.start}–{e.end}{e.end<=e.start?" (다음 날)":""}</b><span>{e.title}{e.breakStart?` · 휴식 ${e.breakStart}–${e.breakEnd}`:""}</span><button type="button" className="icon-button" aria-label={`${e.title} 삭제`} onClick={()=>set({...s,events:s.events.filter(x=>x.id!==e.id)})}><X size={16}/></button></div>)}<div className="event-inputs"><Input label="일정 이름" value={event.title} placeholder="예: 출근 · 업무" onChange={v=>setEvent({...event,title:v.slice(0,60)})}/><Input label="시작" type="time" value={event.start} onChange={v=>setEvent({...event,start:v})}/><Input label="종료" type="time" value={event.end} onChange={v=>setEvent({...event,end:v})}/><Input label="일정 중 쉬는 시간 시작 (선택)" type="time" value={event.breakStart} onChange={v=>setEvent({...event,breakStart:v})}/><Input label="쉬는 시간 종료 (선택)" type="time" value={event.breakEnd} onChange={v=>setEvent({...event,breakEnd:v})}/><button className="button secondary" type="button" disabled={!event.title.trim()||s.events.length>=20} onClick={()=>{if(!event.start||!event.end)return;set({...s,events:[...s.events,{...event,breakStart:event.breakStart||undefined,breakEnd:event.breakEnd||undefined,id:crypto.randomUUID()}]});setEvent({...event,title:""});}}><Plus size={16}/>추가</button></div></div>
  {(localError||error)&&<p className="form-error" role="alert">{localError||error}</p>}<div className="dialog-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>취소</button><button className="button primary" disabled={busy}>{busy?"일정을 배치하고 있어요…":"하루 전체 계획 생성"}<CalendarDays size={16}/></button></div></form></Dialog>;
}


function Report({state,onCheckin}:{state:AppState;onCheckin:()=>void}) {
  const today=localDate();
  const dates=Array.from({length:7},(_,i)=>{const d=new Date(`${today}T12:00:00+09:00`);d.setUTCDate(d.getUTCDate()-6+i);return localDate(d);});
  const days=state.days.filter(d=>dates.includes(d.date)&&Object.keys(d.statuses).length>0);
  const total=days.reduce((n,d)=>n+d.routines.filter(r=>!r.held||!!d.statuses[r.id]).length,0),done=days.reduce((n,d)=>n+d.routines.filter(r=>d.statuses[r.id]==="done").length,0);
  const partial=days.reduce((n,d)=>n+d.routines.filter(r=>d.statuses[r.id]==="partial").length,0);
  const rate=total?Math.round(done/total*100):0;
  const skipped=days.flatMap(d=>d.routines.filter(r=>d.statuses[r.id]==="skipped"));
  const weakest=Object.entries(categoryLabels).map(([k,label])=>({key:k,label,count:skipped.filter(r=>r.category===k).length})).sort((a,b)=>b.count-a.count)[0];
  return <><div className="report-period"><Badge color="neutral"><CalendarDays size={14}/>{dates[0]} — {today}</Badge><span>한국 시간 기준 최근 7일 · 기록한 {days.length}일</span></div><div className="report-metrics"><Panel><span>루틴 완료율</span><strong>{rate}<small>%</small></strong><p>생성한 {total}개 중 {done}개 완료</p></Panel><Panel><span>작은 실천의 합</span><strong>{done+partial}<small>개</small></strong><p>완료 {done}개 · 부분 완료 {partial}개</p></Panel><Panel><span>기록한 날</span><strong>{days.filter(d=>Object.keys(d.statuses).length).length}<small>일</small></strong><p>루틴 상태를 하나 이상 기록한 날</p></Panel></div>
    <Panel><h3>일정 수행 기록 · 최근 7일</h3><p>완료 {state.planner?.records?.filter(r=>dates.includes(r.date)&&r.status==="done").length??0}개 · 일부 진행 {state.planner?.records?.filter(r=>dates.includes(r.date)&&r.status==="partial").length??0}개 · 미진행 {state.planner?.records?.filter(r=>dates.includes(r.date)&&r.status==="skipped").length??0}개</p><p className="muted">수업·알바 등 일정 기록은 건강 루틴 완료율과 별도로 집계해요. 미기록을 실패로 간주하지 않아요.</p>{state.planner?.records?.filter(r=>dates.includes(r.date)).map(r=><p key={`${r.blockId}-${r.date}`}>{r.date} · {r.title} · {r.status==="done"?"완료":r.status==="partial"?"일부 진행":"미진행"}</p>)}</Panel>
    <Panel><SectionHead label="YOUR LAST 7 DAYS" title="하루하루 쌓아가는 실천"/><div className="week-chart">{dates.map(date=>{const d=days.find(d=>d.date===date);const n=d?.routines.filter(r=>d.statuses[r.id]==="done").length??0;const pct=d?.routines.length?n/d.routines.length*100:0;return <div className={`week-column ${date===today?"is-today":""}`} key={date}><span>{d?`${n}/${d.routines.length}`:"—"}</span><div className="week-bar-track"><div style={{height:`${pct}%`}}/></div><b>{new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"Asia/Seoul"}).format(new Date(`${date}T12:00:00+09:00`))}</b><small>{date.slice(5).replace("-",".")}</small></div>;})}</div><p className="panel-caption">완료한 루틴만 완료율에 포함해요. 기록 없는 날은 ‘—’로 표시하고 분모에서 제외합니다.</p></Panel>
    <div className="report-insights"><Panel><div className="insight-icon"><Sparkles size={23}/></div><h3>{done+partial?`${done+partial}번, 나를 위한 선택을 했어요.`:"첫 실천을 기록해볼까요?"}</h3><p>{done+partial?"완벽하지 않아도 괜찮아요. 반복할 수 있는 작은 행동이 남는 것이 중요해요.":"체크인 후 루틴의 완료·부분 완료·미완료를 남기면 변화가 보이기 시작해요."}</p><button className="text-link" onClick={onCheckin}>오늘의 컨디션에 맞게 조정<ArrowRight size={15}/></button></Panel><Panel><div className="insight-icon green"><RefreshCw size={23}/></div><h3>다음 루틴은 이렇게 조정해요</h3><p>{weakest.count?`${weakest.label} 루틴이 ${weakest.count}번 어려웠어요. 최근 실행률이 낮으면 다음 생성 시 루틴 수와 운동시간을 줄여요.`:"최근 실행 기록과 오늘의 컨디션을 함께 참고해 계획을 만들어요. 데이터가 쌓이면 난이도를 더 알맞게 조정할 수 있어요."}</p><small>자동 반영 시점: 다음 체크인과 계획 생성</small></Panel></div>
  </>;
}

function InbodyForm({demo,busy,error,onSubmit,onClose}:{demo:boolean;busy:boolean;error:string;onSubmit:(r:Inbody)=>void;onClose:()=>void}) {
  const [v,set]=useState({measuredAt:localDate(),height:"",weight:"",muscle:"",fat:"",bmr:""});
  const [image,setImage]=useState(""),[file,setFile]=useState<File|null>(null),[recognizing,setRecognizing]=useState(false),[notice,setNotice]=useState("");
  const [confirmed,setConfirmed]=useState(false),[providerConsent,setProviderConsent]=useState(false);
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image);},[image]);
  const choose=(f?:File)=>{if(!f)return;if(!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>5*1024*1024){setNotice("5MB 이하의 PNG, JPG, WEBP 이미지를 선택해주세요.");return;}setFile(f);setImage(URL.createObjectURL(f));setNotice("");setConfirmed(false);};
  const recognize=async()=>{if(!file||!providerConsent)return;if(file.size>2.8*1024*1024){setNotice("자동 인식은 2.8MB 이하 이미지를 사용해주세요. 더 큰 이미지는 수치를 직접 입력할 수 있어요.");return;}setRecognizing(true);setNotice("");try{if(demo)throw new Error("예시 체험에서는 외부 OCR로 이미지를 보내지 않아요. 수치를 직접 입력해보세요.");const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});const result=await api("/api/inbody/ocr",{method:"POST",body:JSON.stringify({content})});set(prev=>({...prev,...Object.fromEntries(Object.entries(result.values).map(([k,v])=>[k,String(v)]))}));setNotice("읽어온 값은 틀릴 수 있어요. 결과지와 비교하고 직접 확인해주세요.");}catch(e){setNotice((e as Error).message);}finally{setRecognizing(false);}};
  const submit=()=>{const parsed=inbodySchema.safeParse({...v,bmr:v.bmr?Number(v.bmr):undefined});if(!parsed.success){setNotice(parsed.error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("\n"));return;}if(v.measuredAt>localDate()){setNotice("측정일은 오늘 또는 이전 날짜를 선택해주세요.");return;}if(confirmed)onSubmit(parsed.data);};
  return <Dialog title="InBody 결과를 더할까요?" subtitle="선택 사항이에요. 지금 건너뛰고 나중에 등록해도 괜찮아요." onClose={onClose} wide><div className="inbody-form-layout"><div><label className="upload-area"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>choose(e.target.files?.[0])}/>{image?<img src={image} alt="선택한 InBody 결과지"/>:<><ScanLine size={35}/><b>결과지 이미지 선택</b><span>PNG, JPG, WEBP · 최대 5MB</span></>}</label>{file&&<><label className="check-choice ocr-consent"><input type="checkbox" checked={providerConsent} onChange={e=>setProviderConsent(e.target.checked)}/>자동 인식을 위해 Google Vision으로 결과지를 전송하는 데 동의합니다. 서비스에는 원본을 보관하지 않아요.</label><button className="button secondary full-width" disabled={!providerConsent||recognizing||busy} onClick={recognize}>{recognizing?<LoaderCircle size={16} className="spin"/>:<ScanLine size={16}/>}이미지 자동 인식 시도</button></>}<p className="muted text-small">이름·생년월일 등 불필요한 식별정보는 가리고 업로드해주세요. 자동 인식은 2.8MB 이하 이미지를 사용하며, OCR 연결 전에는 직접 입력을 이용할 수 있어요.</p></div><form onSubmit={e=>{e.preventDefault();submit();}}><div className="form-grid"><div className="form-span"><Input label="측정일" type="date" value={v.measuredAt} required onChange={n=>{set({...v,measuredAt:n});setConfirmed(false);}}/></div>{[["height","키 (cm)",100,230],["weight","체중 (kg)",25,300],["muscle","골격근량 (kg)",5,100],["fat","체지방률 (%)",2,65],["bmr","기초대사량 (kcal, 선택)",500,4000]].map(([key,label,min,max])=><Input key={String(key)} label={String(label)} type="number" value={v[key as keyof typeof v]} min={Number(min)} max={Number(max)} required={key!=="bmr"} onChange={n=>{set({...v,[key]:n});setConfirmed(false);}}/>)}</div><label className="check-choice confirm-values"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>결과지와 수치를 비교해 확인했어요.</label>{(notice||error)&&<p className="form-error" role="status">{notice||error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>지금은 건너뛰기</button><button className="button primary" disabled={!confirmed||busy||recognizing}>{busy?"저장 중…":"확인한 수치 저장"}<Check size={15}/></button></div></form></div></Dialog>;
}
