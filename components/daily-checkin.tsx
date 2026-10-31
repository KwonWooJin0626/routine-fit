"use client";
import { useState } from "react";
import type { Answers, Checkin, Day } from "@/lib/model";
import { checkinSchema } from "@/lib/model";
import { Input } from "./forms";
import { ChoiceButtons } from "./choice-buttons";
import { QuestionFrame } from "./question-frame";

export function DailyCheckin({initial,style,hasActivities=false,onPlan,busy,error,onSubmit,onClose,preview}:{initial:Checkin;hasActivities?:boolean;onPlan?:()=>void;style:Answers["planningStyle"];busy:boolean;error:string;onSubmit:(c:Checkin)=>void;onClose:()=>void;preview:(c:Checkin)=>Day}){
  const [c,set]=useState<Checkin>(initial),[step,setStep]=useState(0),[notice,setNotice]=useState("");
  const update=<K extends keyof Checkin>(key:K,value:Checkin[K])=>set(s=>({...s,[key]:value}));
  const planned=style==="planned",total=hasActivities?4:planned?5:8;
  const submit=()=>{const result=checkinSchema.safeParse({...c,reported:true});if(!result.success){setNotice("수면시간과 선택한 값을 확인해주세요.");return;}setNotice("");onSubmit(result.data);};
  const titles=["지금의 에너지는 어떤가요?","어젯밤 실제로 얼마나 주무셨나요?","오늘 새 루틴에 쓸 수 있는 시간은요?","오늘 새로운 몸 불편이 있나요?","어젯밤 잠은 어땠나요?","오늘 운동할 계획이 있나요?","공부·집중 업무는 얼마나 할 예정인가요?","오늘의 부담은 어느 정도인가요?"];
  const hints=[planned?"등록된 일정은 다시 묻지 않아요. 오늘 컨디션으로 미완료 추천을 조정해요.":"오늘 가능한 만큼만 추천할게요. 짧은 기본 체크만 마치고 바로 시작할 수도 있어요.","평균 수면 범위와 다른 실제 기록이에요. 모르면 미입력으로 남겨요.","기존 일정 외에 추가할 수 있는 시간이에요.","불편한 날에는 새로운 활동보다 쉬는 선택을 우선해요.","수면량과 느낌을 구분해 참고해요.","예정한 운동을 수행 완료로 기록하지 않아요.","집중 활동 사이에 작은 휴식·정리 루틴을 제안하는 데 참고해요.","오늘의 스트레스와 바쁜 정도를 반영해요."];
  return <QuestionFrame step={step} total={total} title={hasActivities?["오늘 활동할 여유는 어떤가요?","오늘 모든 새 루틴에 쓸 수 있는 시간은요?","오늘 새로운 몸 불편이 있나요?","오늘은 어떤 방식으로 할까요?"][step]:titles[step]} hint={hasActivities?"저장한 목표·선호는 다시 묻지 않아요. 오늘 분량만 조정하며 주간 목표와 이전 실천 기록은 유지해요.":hints[step]} onClose={onClose} busy={busy} error={notice||error} onBack={step?()=>setStep(s=>s-1):undefined} onNext={()=>step<total-1?setStep(s=>s+1):submit()} nextLabel={step===total-1?"오늘의 루틴 보기":"다음"}>
    <span className="sr-only">CHECK-IN {step+1} / {total}</span>
    {hasActivities?<>
      {step===0&&<ChoiceButtons label="오늘 에너지" value={String(c.energy)} options={{5:"상쾌해요",4:"괜찮아요",3:"보통이에요",2:"많이 피곤해요",1:"매우 지쳐요"}} onChange={v=>update("energy",Number(v))}/>}
      {step===1&&<ChoiceButtons label="모든 분야가 함께 사용할 시간" value={String(c.minutes)} options={Object.fromEntries([...new Set([5,30,60,120,240,c.minutes])].sort((a,b)=>a-b).map(n=>[n,`${n}분`]))} onChange={v=>update("minutes",Number(v))}/>}
      {step===2&&<ChoiceButtons label="통증·어지럼·발열 등 새로운 불편" value={c.unwell?"yes":"no"} options={{no:"없어요",yes:"있어요 · 회복 우선"}} onChange={v=>update("unwell",v==="yes")}/>}
      {step===3&&<><ChoiceButtons label="오늘 활동 방식" value={c.activityMode??"same"} options={{same:"계획한 범위에서",light:"가볍게 줄이기",rest:"오늘 새 활동은 쉬기"}} onChange={v=>update("activityMode",v as Checkin["activityMode"])}/><p className="question-small">일정이나 장소가 바뀌면 계획표 또는 목표·활동 수정을 이용해요.</p>{onPlan&&<button type="button" className="text-link" disabled={busy} onClick={onPlan}>계획표 확인·수정</button>}</>}
    </>:<>
    {step===0&&<ChoiceButtons label="오늘 에너지" value={String(c.energy)} options={{5:"상쾌해요",4:"괜찮아요",3:"보통이에요",2:"많이 피곤해요",1:"매우 지쳐요"}} onChange={v=>update("energy",Number(v))}/>}
    {step===1&&<><ChoiceButtons label="어젯밤 실제 수면시간" value={c.sleepKnown===false?"unknown":String(c.sleep)} options={{unknown:"아직 모르겠어요",4:"4시간",5:"5시간",6:"6시간",7:"7시간",8:"8시간",9:"9시간"}} onChange={v=>set(p=>({...p,sleepKnown:v!=="unknown",...(v!=="unknown"?{sleep:Number(v)}:{})}))}/><details className="question-help"><summary>다른 수면시간 직접 입력</summary><Input label="실제 수면시간 (시간)" type="number" min={0} max={14} value={c.sleepKnown===false?"":c.sleep} onChange={v=>set(p=>({...p,sleep:v===""?7:Number(v),sleepKnown:v!==""}))}/></details></>}
    {step===2&&<ChoiceButtons label="루틴 가능 시간" value={String(c.minutes)} options={{5:"5분",10:"10분",15:"15분",20:"20분",30:"30분",60:"60분"}} onChange={v=>update("minutes",Number(v))}/>}
    {step===3&&<ChoiceButtons label="통증·어지럼·발열 등 새로운 불편" value={c.unwell?"yes":"no"} options={{no:"없어요",yes:"있어요 · 회복 우선"}} onChange={v=>update("unwell",v==="yes")}/>}
    {step===4&&<><ChoiceButtons label="수면의 질" value={c.sleepQuality??"unknown"} options={{good:"푹 잤어요",okay:"보통이에요",poor:"뒤척이거나 부족했어요",unknown:"잘 모르겠어요"}} onChange={v=>update("sleepQuality",v as Checkin["sleepQuality"])}/>{!planned&&<button type="button" className="text-link" disabled={busy} onClick={submit}>기본 체크만 마치고 루틴 보기</button>}</>}
    {step===5&&<><ChoiceButtons label="오늘 운동 계획" value={c.exerciseType??"unknown"} options={{unknown:"아직 몰라요",none:"없어요",light:"가벼운 활동",strength:"근력운동",cardio:"유산소운동"}} onChange={v=>set(p=>({...p,exerciseType:v as Checkin["exerciseType"],exerciseMinutes:0}))}/>{c.exerciseType&&!["none","unknown"].includes(c.exerciseType)&&<ChoiceButtons label="예정 시간" value={String(c.exerciseMinutes??0)} options={{0:"시간 미정",15:"15분",30:"30분",60:"60분",90:"90분",120:"120분"}} onChange={v=>update("exerciseMinutes",Number(v))}/>}</>}
    {step===6&&<ChoiceButtons label="공부·집중 업무 예정 시간" value={String(c.studyMinutes??0)} options={{0:"아직 몰라요·없어요",60:"1시간",120:"2시간",240:"4시간",360:"6시간 이상"}} onChange={v=>update("studyMinutes",Number(v))}/>}
    {step===7&&<><ChoiceButtons label="오늘 스트레스" value={String(c.stress)} options={{1:"편안해요",2:"낮아요",3:"보통",4:"높아요",5:"매우 높아요"}} onChange={v=>update("stress",Number(v))}/><ChoiceButtons label="오늘 일정의 여유" value={c.busy?"busy":"usual"} options={{usual:"평소와 비슷해요",busy:"평소보다 바빠요"}} onChange={v=>update("busy",v==="busy")}/></>}
    {step===total-1&&<details className="question-help"><summary>루틴 미리보기</summary><ul>{preview(c).routines.map(r=><li key={r.id}>{r.title} · {r.minutes}분</li>)}</ul><p>완료·직접 추가한 루틴은 유지해요. 저장 후 오늘의 루틴으로 이동해요.</p></details>}
    </>}
  </QuestionFrame>;
}
