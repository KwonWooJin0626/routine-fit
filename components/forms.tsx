"use client";
import { useEffect, useLayoutEffect, useId, useRef, type ReactNode } from "react";
import { X, ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { type Answers, defaultAnswers, answersSchema, goalLabels } from "@/lib/model";
import { useState } from "react";
import { QuestionSources } from "./evidence-sources";
import { ServiceWalkthrough } from "./service-walkthrough";

export function Field({ label, hint, children, question }: { label: string; hint?: string; children: ReactNode; question?:string }) {
  return <div className="field"><div className="field-heading"><span>{label}</span>{hint && <span className="field-hint">{hint}</span>}</div>{children}{question&&<QuestionSources question={question}/>}</div>;
}
export function Input({ label, hint, value, onChange, type = "text", min, max, required, placeholder, question }: { label: string; hint?: string; value: string | number; onChange: (value: string) => void; type?: string; min?: number; max?: number; required?: boolean; placeholder?: string; question?:string }) {
  const id = useId(); return <div className="field"><label htmlFor={id}>{label}</label>{hint && <small>{hint}</small>}<input id={id} type={type} value={value} min={min} max={max} step={type === "number" ? "any" : undefined} required={required} placeholder={placeholder} onInput={type === "time" || type === "date" ? e => onChange(e.currentTarget.value) : undefined} onChange={e => onChange(e.target.value)} />{question&&<QuestionSources question={question}/>}</div>;
}
export function Select({ label, value, options, onChange, hint, description, question }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void; hint?: string; description?: ReactNode; question?:string }) {
  const id = useId(), descriptionId = `${id}-description`;
  return <div className="field"><label htmlFor={id}>{label}</label>{hint && <small>{hint}</small>}<select id={id} value={value} aria-describedby={description ? descriptionId : undefined} onChange={e => onChange(e.target.value)}>{Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>{description && <div id={descriptionId} className="field-description">{description}</div>}{question&&<QuestionSources question={question}/>}</div>;
}
export function Scale({ label, value, onChange, min = 1, max = 5, unit = "", hint, question }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; unit?: string; hint?: string; question?:string }) {
  const id = useId(); return <div className="field scale"><label htmlFor={id}>{label}<strong>{value}{unit}</strong></label>{hint && <small>{hint}</small>}<input id={id} type="range" min={min} max={max} step="1" value={value} onChange={e => onChange(Number(e.target.value))} /><div className="scale-ends"><span>{min}{unit}</span><span>{max}{unit}</span></div>{question&&<QuestionSources question={question}/>}</div>;
}
export function Toggle({ label, checked, onChange, hint, question }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string; question?:string }) {
  return <div className="toggle-field"><label className="toggle-row"><span>{label}{hint && <small>{hint}</small>}</span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span className="switch" aria-hidden="true" /></label>{question&&<QuestionSources question={question}/>}</div>;
}
export function Dialog({ title, subtitle, children, onClose, wide = false, resetKey }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; resetKey?: string | number }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const d = ref.current; if (!d) return; const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null; d.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { d.close(); document.body.style.overflow = previous; trigger?.focus(); }; }, []);
  useLayoutEffect(() => {
    if (resetKey === undefined) return;
    const dialog = ref.current;
    if (!dialog) return;
    // The native dialog, not window, owns the wizard's scroll position.
    dialog.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    dialog.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [resetKey]);
  return <dialog ref={ref} className={`dialog ${wide ? "wide" : ""}`} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}><header className="dialog-head"><div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></header><div className="dialog-content">{children}</div></dialog>;
}

const steps = ["기본 정보", "수면·회복", "식사·영양", "움직임·일상", "안전 확인", "분석 준비"];
const reasons = ["나의 목표와 생활환경이 추천의 기준이 돼요.", "수면시간과 수면의 질을 함께 살펴봐요.", "무엇을 얼마나 자주 먹는지 알아야 식사와 영양 정보를 제안할 수 있어요.", "실제로 가능한 시간과 몸 상태에 맞춰 루틴을 만들어요.", "영양제 성분 정보를 보여주기 전에 반드시 확인해요.", "답변을 확인하고 나에게 맞는 첫 루틴을 만들어요."];

export function Onboarding({ initial, draft, onDraft, busy, error, onComplete, onClose }: { initial?: Answers; draft?: {answers:Answers;step:number}; onDraft?:(draft:{answers:Answers;step:number}|undefined)=>void; busy: boolean; error: string; onComplete: (a: Answers) => void; onClose: () => void }) {
  const [a, set] = useState<Answers>(draft?.answers ?? initial ?? { ...defaultAnswers });
  const [step, setStep] = useState(draft?.step??0), [consent, setConsent] = useState(false), [localError, setLocalError] = useState("");
  const [showGuide, setShowGuide] = useState(!initial && !draft);
  const [guideStep, setGuideStep] = useState(0);
  const [questionsStarted, setQuestionsStarted] = useState(!!initial || !!draft);
  const keepAndClose=()=>{if(questionsStarted)onDraft?.({answers:a,step});onClose();};
  function update<K extends keyof Answers>(key: K, value: Answers[K]) { set(prev => ({ ...prev, ...( ["conditions","medicines","pregnancy","surgery","allergy","uncertainSafety","safetyDetails","currentSupplements","confirmedDeficiency"].includes(key)?{safetyReviewed:false}:{}), [key]: value })); }
  const number = (key: keyof Answers, label: string, min: number, max: number, hint?: string) => <Input key={key} question={key} label={label} hint={hint} type="number" value={a[key] as number} min={min} max={max} onChange={v => update(key, Number(v) as never)} />;
  const optionalNumber = (key:keyof Answers,label:string,max:number,hint:string) => <Input key={key} question={key} label={label} hint={hint} type="number" value={(a[key] as number|null|undefined)??""} min={0} max={max} placeholder="모르면 비워두세요" onChange={v=>update(key,(v.trim()===""?null:Number(v)) as never)}/>;
  const select = (key: keyof Answers, label: string, options: Record<string, string>, hint?: string) => <Select key={key} question={key} label={label} hint={hint} value={String(a[key])} options={options} onChange={v => update(key, (key === "available" ? Number(v) : v) as never)} />;
  const toggle = (key: keyof Answers, label: string, hint?: string) => <Toggle key={key} question={key} label={label} hint={hint} checked={a[key] as boolean} onChange={v => update(key, v as never)} />;
  const scale = (key: keyof Answers, label: string, max = 5, min = 1, unit = "") => <Scale key={key} question={key} label={label} value={a[key] as number} onChange={v => update(key, v as never)} max={max} min={min} unit={unit} />;
  const next = () => {
    const result = answersSchema.safeParse(a);
    if(step===4&&!a.safetyReviewed){setLocalError("안전정보를 직접 확인한 뒤 확인 체크를 선택해주세요. 모르는 항목은 ‘확신하기 어려워요’를 선택하세요.");return;}
    if (step === 0 && !a.name.trim()) { setLocalError("불러드릴 이름을 입력해주세요."); return; }
    if (!result.success) { setLocalError("입력 범위를 확인해주세요. 숫자가 비어 있거나 범위를 벗어나면 다음 단계로 갈 수 없어요."); return; }
    setLocalError(""); setStep(n => Math.min(5, n + 1));
  };
  return <Dialog title={showGuide ? "ROUTINE FIT 사용 안내" : initial ? "생활패턴 다시 살펴보기" : "나를 알아가는 첫 번째 질문"} subtitle={showGuide ? "질문을 시작하기 전, 기능과 입력할 내용을 가볍게 알아보세요." : "정답은 없어요. 처음 표시된 값은 입력 예시입니다. 최근 일주일의 실제 모습으로 수정해주세요."} onClose={keepAndClose} wide resetKey={showGuide ? `guide-${guideStep}` : `question-${step}`}>
    {showGuide ? <ServiceWalkthrough step={guideStep} onStepChange={setGuideStep} onStart={()=>{setQuestionsStarted(true);setShowGuide(false);}} resume={questionsStarted} /> : <>
    <div className="wizard-guide-link"><span>답변하기 전에 기능이 궁금하다면</span><button type="button" className="text-link" onClick={()=>{setGuideStep(0);setShowGuide(true);}}>서비스 이용방법 보기<ArrowRight size={14}/></button></div>
    <div className="draft-notice">닫아도 이 탭에서 답변을 이어 쓸 수 있어요. 새로고침·로그아웃하면 초안은 사라져요. <button type="button" className="text-link" onClick={()=>{onDraft?.(undefined);set(initial??{...defaultAnswers});setStep(0);setConsent(false);}}>초안 초기화</button></div>
    <div className="wizard-steps">{steps.map((s, i) => <div key={s} className={i === step ? "current" : i < step ? "past" : ""}><span>{i < step ? <Check size={12} /> : i + 1}</span><small>{s}</small></div>)}</div>
    <div className="wizard-intro"><span className="eyebrow">STEP {String(step + 1).padStart(2, "0")} / 06</span><h3 tabIndex={-1} data-step-heading>{steps[step]}</h3><p>{reasons[step]}</p></div>
    <p className="question-scope">가이드라인을 참고한 자체 생활패턴 질문입니다. PSQI·PSS·NQ 공식 검사는 아니에요. 각 항목의 ‘참고 자료’를 누르면 자료 제목을 확인할 수 있어요.</p>
    <form onSubmit={e => { e.preventDefault(); if (step === 5) { if (consent) onComplete(a); } else next(); }}>
    <div className="form-grid">
      {step === 0 && <>
        <Input label="어떻게 불러드릴까요?" value={a.name} onChange={v => update("name", v.slice(0,24))} required placeholder="닉네임 또는 이름" />
        {select("age", "연령대", {"18-29":"18–29세", "30-39":"30–39세", "40-49":"40–49세", "50-64":"50–64세", "65+":"65세 이상"})}
        {select("goal", "가장 먼저 챙기고 싶은 목표", goalLabels)}
        {select("work", "평소 일정 형태", {regular:"규칙적인 주간 일정", flexible:"유동적인 일정", shift:"교대근무", student:"학업 중심", care:"육아·돌봄 중심"})}
        <div className="form-span note">현재 MVP는 성인 대상이에요. 목표는 언제든 설정에서 다시 바꿀 수 있어요. 키·체중은 체성분 기록이 필요할 때 선택 입력해요.</div>
      </>}
      {step === 1 && <>
        <Input question="bed" label="평소 잠드는 시간" type="time" value={a.bed} onChange={v => update("bed", v)} required />
        <Input question="wake" label="평소 일어나는 시간" type="time" value={a.wake} onChange={v => update("wake", v)} required />
        {number("sleepHours", "실제로 자는 시간 (시간)", 2, 12, "누워 있는 시간보다 실제 수면시간을 알려주세요.")}
        {optionalNumber("scheduleShiftHours", "평일·주말 취침/기상 시각 차이 (시간, 선택)", 6,"잠드는 시각과 일어나는 시각 중 더 크게 달라지는 쪽을 알려주세요. 잘 모르면 비워두세요.")}
        {scale("sleepQuality", "수면의 질", 5, 1)}
        <Field question="sleepSymptoms" label="반복되는 수면 불편 (선택)" hint="해당 없으면 선택하지 않아도 돼요. PSQI 검사는 아닙니다."><div className="choice-grid">{Object.entries({falling:"잠들기 어려움",waking:"자주 깸",snoring:"심한 코골이",sleepy:"낮 동안 심한 졸림"}).map(([v,l]) => <label className="check-choice" key={v}><input type="checkbox" checked={a.sleepSymptoms.includes(v as never)} onChange={e => update("sleepSymptoms", e.target.checked ? [...a.sleepSymptoms, v as never] : a.sleepSymptoms.filter(s => s !== v))}/>{l}</label>)}</div></Field>
      </>}
      {step === 2 && <>
        {number("meals", "하루 식사 횟수", 1, 4)}
        {select("skip", "자주 거르는 식사", {none:"거르지 않아요",breakfast:"아침",lunch:"점심",dinner:"저녁"})}
        <div className="form-span">{toggle("regularMeals", "식사시간이 대체로 일정한가요?")}</div>
        {number("vegetables", "채소를 먹은 날 (주 0–7일)", 0, 7)}{number("fruit", "과일을 먹은 날 (주 0–7일)", 0, 7)}
        <details className="form-span optional-questions"><summary>더 정확한 식생활 분석을 위한 추가 질문 (선택)</summary><div className="form-grid">{optionalNumber("fruitVegGrams","하루 채소·과일 합계 (g, 선택)",2000,"최근 일주일 하루 평균의 대략적 무게예요. 감자 등 전분성 뿌리식품·주스 제외. 잘 모르겠다면 비워두세요.")}
        {optionalNumber("wholegrainDays","통곡물·잡곡을 먹은 날 (선택)",7,"최근 일주일 0–7일. 공식 NQ 점수로 계산하지 않아요.")}
        {optionalNumber("legumeDays","콩·두부를 먹은 날 (선택)",7,"최근 일주일 0–7일. 식품군 다양성을 살펴봐요.")}
        {optionalNumber("processedMeatDays","가공육을 먹은 날 (선택)",7,"햄·소시지 등. 최근 일주일 0–7일이며 양과 식사 구성도 중요해요.")}
        </div></details>{number("protein", "단백질 식품을 먹은 날 (주 0–7일)", 0, 7, "콩·두부·달걀·생선·고기 등")}{number("fish", "생선을 먹은 날 (주 0–7일)", 0, 7)}
        {number("dairy", "유제품·대체식품을 먹은 날", 0, 7, "칼슘 강화 여부와 실제 양은 별도 확인이 필요해요.")}{select("diet", "식단 형태", {mixed:"특별한 제한 없음",vegetarian:"채식",vegan:"비건",restricted:"특정 식품 제한"})}
        {number("takeaway", "배달·외식 횟수 (주 0–14회)", 0, 14)}{number("lateMeals", "야식을 먹은 날 (주 0–7일)", 0, 7)}
        {number("water", "하루 물 섭취 (약 200ml 컵)", 0, 15)}{number("caffeine", "하루 카페인 음료 (잔)", 0, 10)}
        <Input question="caffeineTime" label="마지막 카페인 섭취시간" type="time" value={a.caffeineTime} onChange={v => update("caffeineTime", v)} />
        {number("alcohol", "술을 마시는 날 (주 0–7일)", 0, 7)}
        {select("smoking", "흡연 여부", {no:"흡연하지 않아요",former:"과거에 피웠어요",yes:"현재 피워요"})}
      </>}
      {step === 3 && <>
        {number("exerciseDays", "일주일 운동 일수", 0, 7)}{number("exerciseMinutes", "운동 1회 시간 (분)", 0, 180)}
        {select("exerciseIntensity", "평소 운동 강도", {light:"가벼움 · 숨이 편하고 말하기 쉬워요",moderate:"중간 · 숨이 차지만 대화할 수 있어요",vigorous:"높음 · 숨이 많이 차서 말이 끊겨요"}, "운동하는 동안의 숨찬 정도를 떠올려주세요.")}
        <details className="form-span optional-questions"><summary>활동량을 기준과 비교하기 위한 추가 질문 (선택)</summary><div className="form-grid"><div className="form-span note">아래 주간 합계는 운동뿐 아니라 일·통학·출퇴근 활동도 포함해요. 위 운동시간을 다시 더하지 말고, 같은 활동은 한 번만 계산해주세요. 가벼운 활동과 근력운동은 유산소 합계에서 제외해요. 0분과 모름은 다르게 처리합니다.</div>
        {optionalNumber("moderateWeeklyMinutes","주간 중강도 유산소 합계 (분, 선택)",2520,"숨이 차지만 대화 가능한 활동. 예: 빠르게 걷기 30분 × 5일 = 150분.")}
        {optionalNumber("vigorousWeeklyMinutes","주간 고강도 유산소 합계 (분, 선택)",2520,"숨이 많이 차 말이 끊기는 활동. 하지 않았다면 0, 모르면 빈칸.")}
        {number("strengthDays", "주간 근력운동 일수", 0, 7)}{number("sitting", "하루 앉아 있는 시간", 0, 18)}
        <Select question="strengthAllGroups" label="주요 근육군을 사용하는 근력운동인가요?" hint="다리·엉덩이·등·배·가슴·어깨·팔 등. 중강도 이상 여부도 함께 확인해요." value={a.strengthAllGroups??"unknown"} options={{unknown:"잘 모르겠어요",yes:"주요 근육군을 중강도 이상으로 운동해요",no:"일부만 하거나 근력운동을 하지 않아요"}} onChange={v=>update("strengthAllGroups",v as Answers["strengthAllGroups"])}/>
        </div></details><div className="form-span">{toggle("movementLimit", "통증·부상·의료진의 운동 제한이 있나요?", "있다면 고강도 운동을 제안하지 않아요.")}</div>
        {scale("stress", "최근 스트레스 · 높을수록 심함")}{scale("energy", "최근 에너지 · 높을수록 활기참")}
        <div className="form-span"><Select label="하루 건강관리에 추가로 쓸 수 있는 시간" value={String(a.available)} options={{"5":"5분", "10":"10분", "15":"15분", "20":"20분", "30":"30분", "60":"60분"}} onChange={v => update("available", Number(v))} description={<><p><strong>예: 산책 10분 + 스트레칭 3분 + 호흡·휴식 2분 = 총 15분</strong></p><p>하루 중 여러 번 나누어 실천해도 괜찮아요. 수면·식사·출퇴근 전체 시간이 아니라, 새 건강 루틴에 추가로 쓸 시간만 선택해주세요.</p></>} /></div>
        {select("barrier", "계획을 방해하는 가장 큰 이유", {time:"시간 부족",tired:"피로",forget:"잊어버림",hard:"목표가 어려움",environment:"환경 제약"})}
      </>}
      {step === 4 && <><div className="form-span note">안전 항목은 직접 확인해주세요. 모르는 내용이 있으면 확신하기 어려움을 선택하세요. 미확인 상태에서는 구매 연결을 보류해요.</div>
        <div className="form-span">{toggle("supplementOptIn", "식생활에 맞는 영양성분 정보도 받고 싶어요", "동의하지 않아도 건강 루틴을 이용할 수 있어요.")}</div>
        <div className="form-span safety-list">
          {toggle("conditions", "진단받고 관리·치료 중인 질환이 있나요?")}
          {toggle("medicines", "처방약 또는 일반의약품을 복용하나요?")}
          {toggle("pregnancy", "임신·수유 중이거나 임신을 계획하고 있나요?")}
          {toggle("surgery", "최근 수술을 받았거나 수술·시술이 예정되어 있나요?")}
          {toggle("allergy", "식품·영양제 알레르기나 이상 반응이 있었나요?")}
          {toggle("uncertainSafety", "위 안전 질문에 확실히 답하기 어려운 항목이 있나요?")}
        </div>
        {a.supplementOptIn&&<><Input question="currentSupplements" label="현재 복용 영양제 (없으면 비워두세요)" value={a.currentSupplements} onChange={v => update("currentSupplements", v.slice(0,500))} hint="제품명·함량·횟수. 입력하면 중복 여부를 전문가와 먼저 확인하도록 안내해요." />
        <Input question="confirmedDeficiency" label="검사에서 확인받은 영양소 부족 (선택)" value={a.confirmedDeficiency} onChange={v => update("confirmedDeficiency", v.slice(0,300))} hint="검사명·검사일. 서비스에서 검사결과를 진단하지 않아요." /></>}
        <div className="form-span"><Input question="safetyDetails" label="추가로 전달할 안전 정보 (선택)" value={a.safetyDetails} onChange={v => update("safetyDetails", v.slice(0,500))} /></div>
        <div className="form-span note"><ShieldCheck size={18}/> 복약·질환·알레르기 등 확인이 필요한 경우 제품 구매 연결을 제한하고 전문가 상담을 안내해요.</div>
        <div className="form-span">{toggle("safetyReviewed","위 안전정보를 직접 확인했어요")}</div>
      </>}
      {step === 5 && <>
        <div className="form-span review-summary"><div className="avatar large">{a.name.slice(0,1)}</div><h3>{a.name}님의 첫 루틴을 준비했어요</h3><p>{goalLabels[a.goal]}을 목표로, 하루 {a.available}분 안에서 시작해요.</p><div className="review-stats"><span>수면 <b>{a.sleepHours}시간</b></span><span>운동 <b>주 {a.exerciseDays}일</b></span><span>문진 <b>6단계 완료</b></span></div></div>
        <div className="form-span consent-box"><h4>건강정보 수집·이용 동의</h4><p>생활패턴·안전 응답·선택적 InBody 수치를 맞춤 루틴과 영양정보 제공 목적으로 저장합니다. 최근 90일 계획과 최대 30건의 체성분 기록을 보관하며, 설정에서 조회·내보내기·삭제할 수 있어요. InBody 이미지는 별도 인식 동의 시에만 OCR 제공자에게 전송하고 서비스 저장소에는 보관하지 않습니다.</p><p>설문은 임상 검사가 아니며 질병·영양소 결핍을 확정하지 않습니다. 예시 체험에서는 입력 내용을 서버에 저장하지 않습니다.</p><label className="check-choice"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required />위 건강정보 처리와 서비스 범위를 확인하고 동의합니다.</label></div>
      </>}
    </div>
    {(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}
    <footer className="wizard-actions"><button type="button" className="button secondary" disabled={step === 0 || busy} onClick={() => { setLocalError(""); setStep(n => n - 1); }}><ArrowLeft size={16}/> 이전</button><span className="muted">{step === 5 ? "동의 후 언제든 삭제할 수 있어요" : "약 4~6분 · 닫아도 이 탭에서 이어 쓸 수 있어요"}</span><button className="button primary" type="submit" disabled={busy || (step === 5 && !consent)}>{busy ? "루틴 준비 중…" : step === 5 ? "내 루틴 만들기" : "다음 질문"}<ArrowRight size={16}/></button></footer>
    </form>
    </>}
  </Dialog>;
}
