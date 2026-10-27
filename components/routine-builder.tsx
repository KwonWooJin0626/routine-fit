"use client";
import { useState } from "react";
import { z } from "zod";
import { Check, Clock3, Coffee, Dumbbell, Heart, Moon, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { type Answers, type Checkin, type Day, type Inbody, type Routine, categoryLabels, checkinSchema } from "@/lib/model";
import { conditionSummary, getRoutineCatalog, MAX_DAILY_ROUTINES } from "@/lib/routine-catalog";
import { Dialog, Input, Scale, Select, Toggle } from "./forms";
import { routineSearchText } from "@/lib/routine-guidance";
import { RoutineGuidance } from "./routine-guidance";
import { RoutineSources } from "./evidence-sources";
import type { NutritionProfile } from "@/lib/nutrition-profile";
import { guidanceForRoutine } from "@/lib/routine-guidance";

const icons = {sleep:Moon,food:Coffee,move:Dumbbell,mind:Heart};
const customSchema = z.object({title:z.string().trim().min(1,"루틴 이름을 입력해주세요.").max(80),category:z.enum(["sleep","food","move","mind"]),minutes:z.coerce.number().int().min(1).max(120),detail:z.string().trim().max(300),when:z.string().trim().min(1).max(80),preferredTime:z.union([z.literal(""),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])});

export function RoutineBuilder({answers,day,inbody,busy,onAdd,nutrition}:{answers:Answers;day:Day;inbody?:Inbody;busy:boolean;onAdd:(r:Routine)=>void;nutrition?:NutritionProfile}) {
  const [category,setCategory] = useState("all"),[query,setQuery] = useState(""),[limit,setLimit] = useState(8);
  const [kind,setKind] = useState("all");
  const all = getRoutineCatalog(answers,day.checkin,inbody);
  const categories = Object.keys(categoryLabels) as Routine["category"][];
  const grouped = categories.map(key=>all.filter(r=>r.category===key));
  const balanced = Array.from({length:Math.max(...grouped.map(g=>g.length))},(_,i)=>grouped.map(g=>g[i]).filter((r):r is Routine=>!!r)).flat();
  const filtered = balanced.filter(r => (category === "all" || r.category === category) && (kind === "all" || r.guidance?.kind === kind) && routineSearchText(r).includes(query.trim()));
  const ids = new Set(day.routines.map(r => r.id));
  const remaining = (day.planningContext?.effectiveMinutes??day.checkin.minutes) - day.routines.filter(r=>!r.held&&day.statuses[r.id]!=="done").reduce((n,r) => n+r.minutes,0);
  return <section className="routine-picker" aria-labelledby="routine-picker-title">
    <div className="picker-heading"><div><span className="eyebrow">BUILD YOUR OWN DAY</span><h2 id="routine-picker-title">마음에 드는 루틴을 골라보세요</h2><p>컨디션에 맞는 다양한 행동 중 오늘 하고 싶은 것을 더해요.</p></div><span className="badge neutral">{all.length}가지 추천</span></div>
    <div className="picker-context"><Sparkles size={16}/><span>{conditionSummary(day.checkin)}</span></div>
    {(day.checkin.unwell || answers.movementLimit) && <div className="note"><ShieldCheck size={17}/>오늘은 움직임 추천 대신 회복 행동을 보여드려요. 직접 만드는 활동도 몸 상태에 맞춰 무리하지 마세요.</div>}
    <div className="picker-filters" role="group" aria-label="추천 루틴 분야">{[["all","전체"],...Object.entries(categoryLabels)].map(([key,label])=><button key={key} aria-pressed={category===key} className={category===key?"active":""} onClick={()=>{setCategory(key);setLimit(8);}}>{label}</button>)}</div>
    <div className="picker-filters picker-kinds" role="group" aria-label="루틴 안내 유형">{[["all","모든 활동"],["reading","독서"],["music","음악·장르"],["food","식품·영양"]].map(([key,label])=><button key={key} aria-pressed={kind===key} className={kind===key?"active":""} onClick={()=>{setKind(key);setLimit(8);}}>{label}</button>)}</div>
    <Input label="추천 루틴 검색" value={query} placeholder="예: 독서, 로파이, 브로콜리" onChange={v=>{setQuery(v);setLimit(8);}}/>
    <div className="picker-grid">{filtered.slice(0,limit).map(r=>{const Icon=icons[r.category];const added=ids.has(r.id);return <article key={r.id} className={`picker-card ${added?"is-added":""}`}><div className="picker-card-top"><span className="routine-icon" data-category={r.category}><Icon size={19}/></span><span>{categoryLabels[r.category]}</span><small><Clock3 size={12}/>{r.minutes}분</small></div><h3>{r.title}</h3><p>{r.detail}</p><RoutineGuidance guide={guidanceForRoutine(r,answers,nutrition??null)}/><RoutineSources routine={r}/><div className="picker-card-bottom"><span>{r.when}</span><button className="button secondary" disabled={busy||added||day.routines.length>=MAX_DAILY_ROUTINES} onClick={()=>onAdd({...r,guidance:undefined,source:"catalog"})} aria-label={`${r.title} ${added?"추가됨":"오늘 루틴에 추가"}`}>{added?<Check size={14}/>:<Plus size={14}/>} {added?"추가됨":"오늘에 담기"}</button></div>{!added && r.minutes>remaining && <small className="picker-budget">선택한 시간보다 많아질 수 있어요.</small>}</article>;})}</div>
    {!filtered.length&&<p className="picker-empty" role="status">찾는 루틴이 없어요. 검색어를 바꾸거나 직접 만들어보세요.</p>}
    {filtered.length>limit&&<button className="button secondary picker-more" onClick={()=>setLimit(n=>n+8)}>추천 더 보기 ({filtered.length-limit}개)<Plus size={14}/></button>}
    <p className="picker-footnote">자동 추천은 가능한 시간에 맞는 작은 루틴부터 시작해요. 직접 만든 루틴과 골라 담은 루틴을 합쳐 오늘 최대 {MAX_DAILY_ROUTINES}개까지 관리할 수 있어요.</p>
  </section>;
}

export function CustomRoutineDialog({initial,busy,error,onSubmit,onClose}:{initial?:Routine;busy:boolean;error:string;onSubmit:(r:Routine)=>void;onClose:()=>void}) {
  const [v,set] = useState(initial?{title:initial.title,category:initial.category,minutes:String(initial.minutes),detail:initial.detail,when:initial.when,preferredTime:initial.preferredTime??""}:{title:"",category:"mind",minutes:"5",detail:"",when:"편한 시간",preferredTime:""}),[notice,setNotice]=useState("");
  const submit=()=>{
    const parsed=customSchema.safeParse(v);
    if(!parsed.success){setNotice(parsed.error.issues.map(i=>i.message).join(" "));return;}
    const {preferredTime,...values}=parsed.data;
    onSubmit({...values,id:initial?.id??`custom-${crypto.randomUUID()}`,preferredTime:preferredTime||undefined,source:"custom",detail:values.detail||"내가 정한 작은 실천이에요.",reason:"직접 만든 루틴이에요. 오늘 가능한 시간과 몸 상태에 맞춰 실천해주세요.",fallback:"시간이나 분량을 줄여 가능한 만큼 실천하기"});
  };
  return <Dialog title={initial?"루틴 내용 수정":"나만의 핵심 루틴 만들기"} subtitle="작고 구체적인 행동 하나를 정해보세요." onClose={onClose}><form onSubmit={e=>{e.preventDefault();submit();}}><div className="form-grid"><div className="form-span"><Input label="루틴 이름" value={v.title} required placeholder="예: 점심 후 공원 한 바퀴 걷기" onChange={title=>set({...v,title:title.slice(0,80)})}/></div><Select label="루틴 분야" value={v.category} options={categoryLabels} onChange={category=>set({...v,category})}/><Input label="예상 소요시간 (분)" type="number" min={1} max={120} value={v.minutes} required onChange={minutes=>set({...v,minutes})}/><Select label="언제 실천할까요?" value={v.when} options={{...(initial?{[initial.when]:initial.when}:{}),"하루 시작 전":"아침", "식사 전":"식사 전", "식사 후":"식사 후", "오후 잠깐":"오후", "저녁":"저녁", "취침 전":"취침 전", "편한 시간":"편한 시간"}} onChange={when=>set({...v,when})}/><Input label="희망시간 (선택)" type="time" value={v.preferredTime} hint="하루 전체 계획에서 참고해요." onChange={preferredTime=>set({...v,preferredTime})}/><div className="form-span"><Input label="실천 방법 (선택)" value={v.detail} placeholder="어디서, 어떻게 실천할지 짧게 적어주세요." onChange={detail=>set({...v,detail:detail.slice(0,300)})}/></div></div><div className="note">직접 만든 루틴은 컨디션 체크 후에도 유지돼요. 의료적 처방이나 복용량 변경을 루틴으로 정하지 마세요.</div>{(notice||error)&&<p className="form-error" role="alert">{notice||error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>취소</button><button className="button primary" disabled={busy}>{busy?"저장 중…":initial?"수정 내용 저장":"만들고 오늘에 담기"}<Plus size={15}/></button></div></form></Dialog>;
}

export function ConditionDialog({initial,busy,error,onSubmit,onClose,preview}:{initial:Checkin;busy:boolean;error:string;onSubmit:(c:Checkin)=>void;onClose:()=>void;preview:(c:Checkin)=>Day}) {
  const[c,set]=useState(initial),[notice,setNotice]=useState("");
  const next=preview(c),generated=next.routines.filter(r=>r.source!=="custom"&&r.source!=="catalog"&&!next.statuses[r.id]);
  const retained=next.routines.length-generated.length;
  return <Dialog title="오늘의 나는 어떤가요?" subtitle="입력을 바꾸면 아래 예상 루틴을 바로 확인할 수 있어요. 저장할 때 오늘의 루틴에 반영됩니다." onClose={onClose} wide><form onSubmit={e=>{e.preventDefault();const result=checkinSchema.safeParse(c);if(!result.success){setNotice("수면시간과 가능한 시간의 입력 범위를 확인해주세요.");return;}onSubmit(result.data);}}><div className="condition-layout"><div className="form-grid"><Input question="sleep" label="어젯밤 수면시간" type="number" value={c.sleep} min={0} max={14} onChange={v=>set({...c,sleep:Number(v)})}/><Select label="오늘 가능한 시간" value={String(c.minutes)} options={{5:"5분",10:"10분",15:"15분",20:"20분",30:"30분",60:"60분"}} onChange={v=>set({...c,minutes:Number(v)})} description="산책·스트레칭·휴식 등 새 건강 루틴에 추가로 쓸 시간이에요."/><Scale question="energy" label="오늘의 에너지" value={c.energy} onChange={energy=>set({...c,energy})}/><Scale question="stress" label="오늘의 스트레스" value={c.stress} onChange={stress=>set({...c,stress})}/><div className="form-span"><Select label="주로 실천할 장소" value={c.place} options={{home:"집",office:"회사·학교",outside:"야외",gym:"운동시설"}} onChange={v=>set({...c,place:v as Checkin["place"]})}/><Toggle label="오늘은 평소보다 바쁜 날이에요" checked={c.busy} onChange={busy=>set({...c,busy})}/><Toggle question="unwell" label="새로운 통증·어지럼·발열 등 몸이 불편해요" checked={c.unwell} onChange={unwell=>set({...c,unwell})} hint="선택하면 움직임 추천 대신 회복 행동을 제공해요. 심하거나 지속되는 증상은 의료진에게 확인하세요."/></div></div><section className="condition-preview" aria-label="컨디션 반영 예상 루틴" aria-live="polite"><span className="eyebrow">YOUR NEXT SMALL STEPS</span><h3>저장하면 이렇게 바뀌어요</h3><p>{conditionSummary(c)}</p><ul>{generated.map(r=><li key={r.id}><div><span>{r.title}</span><RoutineSources routine={r}/></div><b>{r.minutes}분</b></li>)}</ul>{retained>0&&<p className="retained-note">직접 추가했거나 실천을 기록한 루틴 {retained}개는 그대로 유지해요.</p>}{!generated.length&&<p>현재 루틴을 모두 직접 추가했거나 실천을 기록했어요. 유지할 루틴을 제외할 공간이 생기면 새 추천을 담을 수 있어요.</p>}<small>컨디션에 맞는 행동·시간을 조정하고, 저장할 때 비슷한 목적의 안전한 행동을 번갈아 제안해요.</small>{next.warnings.map(w=><p className="form-error" key={w}>{w}</p>)}</section></div>{(notice||error)&&<p className="form-error" role="alert">{notice||error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>취소</button><button className="button primary" disabled={busy}>{busy?"준비 중…":"이 컨디션으로 루틴 바꾸기"}<Sparkles size={16}/></button></div></form></Dialog>;
}
