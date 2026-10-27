"use client";
import { useState } from "react";
import { defaultAnswers, type Answers } from "@/lib/model";
import { basicProfileSchema, emptyBasicProfile, sleepRanges, exerciseRanges, sittingRanges } from "@/lib/basic-profile";
import { ingredients } from "@/lib/nutrition";
import { Input } from "./forms";
import { ChoiceButtons } from "./choice-buttons";
import { QuestionFrame } from "./question-frame";
import { QuestionSources } from "./evidence-sources";

export function BasicOnboarding({initial,draft,onDraft,busy,error,onComplete,onClose}:{initial?:Answers;draft?:{answers:Answers;step:number};onDraft?:(d:{answers:Answers;step:number}|undefined)=>void;busy:boolean;error:string;onComplete:(a:Answers)=>void;onClose:()=>void}){
  const [a,set]=useState<Answers>(()=>{const old=draft?.answers??initial;return {...(old??defaultAnswers),basic:old?.basic??emptyBasicProfile(),...(!old?{supplementOptIn:true,uncertainSafety:true,safetyReviewed:false}:{} )};});
  const [step,setStep]=useState(draft?.step??0),[consent,setConsent]=useState(!!initial||(draft?.step??0)>0),[notice,setNotice]=useState("");
  const [group,setGroup]=useState("비타민"),[page,setPage]=useState(0);
  const b=a.basic!;
  const update=(patch:Partial<typeof b>)=>set(p=>({...p,basic:{...p.basic!,...patch}}));
  const choices=[{id:"multi",name:"종합비타민",group:"기타"},...ingredients];
  const filtered=choices.filter(i=>group==="기타"?!["비타민","미네랄"].includes(i.group):i.group===group);
  const visibleChoices=filtered.slice(page*6,page*6+6);
  const total=b.supplementStatus==="yes"?8:7;
  const finish=()=>{
    if(step===0&&!consent){setNotice("안내를 확인하고 동의하거나 닫기를 선택해주세요.");return;}
    if(step===1&&!a.name.trim()){setNotice("닉네임을 입력해주세요.");return;}
    const parsed=basicProfileSchema.safeParse(b);if(!parsed.success){setNotice(parsed.error.issues[0].message);return;}
    setNotice("");if(step<total-1){setStep(s=>s+1);return;}
    onComplete({...a,name:a.name.trim(),basic:{...parsed.data,origin:"range"},...(JSON.stringify(initial?.basic?.supplements)!==JSON.stringify(b.supplements)?{safetyReviewed:false}:{} )});
  };
  const titles=["질문 몇 개로, 오늘의 작은 시작","어떻게 불러드릴까요?","키와 몸무게도 남길까요?","평소 하루 평균 얼마나 주무시나요?","최근 일주일 운동 시간은 총 얼마인가요?","하루 평균 얼마나 앉아 있나요?","현재 먹고 있는 영양제가 있나요?","먹고 있는 성분을 모두 골라주세요"];
  const hints=["기초 질문 → 작은 루틴 → 계획표 작성 → 일정 분석·루틴 정밀화. 자세한 질문은 필요한 기능을 사용할 때만 받아요.","실명 대신 닉네임을 사용해도 좋아요.","선택 사항이에요. 독서·집중 루틴은 신체 정보 없이도 이용할 수 있어요.","최근 일주일의 실제 수면량을 대략 골라주세요. 모르면 그대로 넘어가도 돼요.","운동한 시간을 합쳐주세요. 운동 강도를 확인하기 전에는 권고량 충족 여부를 판단하지 않아요.","공부·일·이동 중 앉아 있던 시간을 합쳐주세요. 연속으로 앉은 시간과는 달라요.","일반적인 성분 정보를 먼저 보여드려요. 제품 추천에 필요한 추가 확인은 나중에 진행해요.","중복 선택할 수 있어요. 성분만으로 제품의 함량·용량·섭취 시기를 확정하지 않아요."];
  return <QuestionFrame step={step} total={total} title={titles[step]} hint={hints[step]} onClose={()=>{onDraft?.({answers:a,step});onClose();}} onBack={step?()=>{setNotice("");setStep(s=>s-1);}:undefined} onNext={finish} busy={busy} error={notice||error} disabled={step===0&&!consent} nextLabel={step===0?"기초 질문 시작":step===total-1?"기본 루틴 받아보기":"다음"}>
    {step===0&&<><div className="mini-journey"><span>01<br/><b>간단한 질문</b></span><span>→</span><span>02<br/><b>루틴 선택</b></span><span>→</span><span>03<br/><b>기록·조정</b></span></div><label className="check-choice"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>성인용 서비스이며, 루틴 제공을 위해 입력한 생활·건강정보를 계정에 저장하는 데 동의해요.</label><p className="question-small">선택 정보는 생략할 수 있어요. 최근 90일 루틴·일정과 최대 30건의 InBody 기록을 보관하며 설정에서 삭제·내려받기가 가능해요. 작성 중 초안은 이 탭에서만 유지해요.</p></>}
    {step===1&&<Input label="이름 또는 닉네임" value={a.name} required placeholder="어떻게 불러드릴까요?" onChange={name=>set(p=>({...p,name:name.slice(0,24)}))}/>}
    {step===2&&<><div className="form-grid"><Input label="키 (cm, 선택)" type="number" value={b.height??""} min={100} max={230} onChange={v=>update({height:v.trim()?Number(v):null})}/><Input label="몸무게 (kg, 선택)" type="number" value={b.weight??""} min={25} max={300} onChange={v=>update({weight:v.trim()?Number(v):null})}/></div><button type="button" className="text-link" onClick={()=>{update({height:null,weight:null});setStep(3);}}>입력하지 않고 건너뛰기</button></>}
    {step===3&&<><ChoiceButtons label="평균 수면시간" value={b.sleepRange} options={sleepRanges} onChange={v=>update({sleepRange:v as typeof b.sleepRange})}/><QuestionSources question="sleepHours"/></>}
    {step===4&&<><ChoiceButtons label="일주일 총 운동 시간" value={b.exerciseRange} options={exerciseRanges} onChange={v=>update({exerciseRange:v as typeof b.exerciseRange})}/><QuestionSources question="exerciseDays"/></>}
    {step===5&&<><ChoiceButtons label="하루 평균 앉아 있는 시간" value={b.sittingRange} options={sittingRanges} onChange={v=>update({sittingRange:v as typeof b.sittingRange})}/><QuestionSources question="sitting"/></>}
    {step===6&&<ChoiceButtons label="영양제 복용 여부" value={b.supplementStatus} options={{yes:"먹고 있어요",none:"먹지 않아요",unknown:"잘 모르겠어요"}} onChange={v=>update({supplementStatus:v as typeof b.supplementStatus,supplements:v==="yes"?b.supplements:[]})}/>}
    {step===7&&<><div className="choice-buttons category-tabs">{["비타민","미네랄","기타"].map(g=><button type="button" key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);setPage(0);}}>{g==="기타"?"단백질·기타":g}</button>)}</div><div className="supplement-choice-grid">{visibleChoices.map(i=><button key={i.id} type="button" aria-pressed={b.supplements.includes(i.id as never)} onClick={()=>update({supplements:b.supplements.includes(i.id as never)?b.supplements.filter(id=>id!==i.id):[...b.supplements,i.id as never]})}>{i.name}</button>)}</div>{filtered.length>6&&<div className="supplement-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>이전 항목</button><span>{page+1} / {Math.ceil(filtered.length/6)}</span><button type="button" disabled={(page+1)*6>=filtered.length} onClick={()=>setPage(p=>p+1)}>다음 항목</button></div>}<p className="question-small" role="status">{b.supplements.length}개 선택 · 제품명·함량은 영양 가이드에서 따로 확인해요.</p></>}
  </QuestionFrame>;
}
