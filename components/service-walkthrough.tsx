"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, ClipboardList, Heart, Leaf, Moon, ScanLine, ShieldCheck, Sparkles, Sun, Utensils } from "lucide-react";

const chapters = [
  { label: "나에게 맞춤", icon: ClipboardList, title: "내 생활을 알면,\n시작할 루틴이 보여요.", description: "수면·식사·움직임·스트레스를 살펴보고 오늘 실천할 핵심 루틴 3~5개를 제안해요.", action: "최근 일주일을 떠올려 질문에 답해주세요.", detail: "기본 문진은 약 4~6분이에요. 모르는 선택 항목은 비워둬도 괜찮아요.", hint: "예시 목표를 바꿔보세요", tag: "질문 → 맞춤 루틴" },
  { label: "일정과 연결", icon: CalendarDays, title: "가볍게 시작하거나,\n하루 전체를 계획해요.", description: "핵심 루틴만 이용해도 좋아요. 하루 전체 계획이 필요하면 일정 사이에 루틴을 배치해요.", action: "전체 계획을 원할 때만 하루 정보와 고정 일정을 더해주세요.", detail: "기상·식사·이동시간, 수업·근무와 날짜별 약속을 등록해요. 주간 계획은 해당 날짜의 하루 계획으로 이어져요.", hint: "두 가지 계획 모드를 눌러보세요", tag: "핵심 루틴 / 하루 전체 계획" },
  { label: "영양·체성분", icon: Leaf, title: "식생활부터 영양정보까지,\n필요한 만큼 더 자세히.", description: "식습관에 맞는 식품·영양성분 정보를 보고, 안전 확인 후 iHerb에서 제품을 찾아볼 수 있어요.", action: "복용 약·질환·알레르기 등 안전정보를 확인해주세요.", detail: "InBody는 선택이에요. 결과표 이미지 또는 직접 확인한 수치를 추가할 수 있어요. 이미지 인식에는 별도 동의가 필요해요.", hint: "InBody 예시를 펼쳐보세요", tag: "안전 확인 · InBody 선택 등록" },
  { label: "기록과 조정", icon: CheckCheck, title: "작은 실천을 체크하고,\n내 속도로 이어가요.", description: "루틴을 골라 담거나 직접 만들고, 실천을 체크해요. 주간 리포트에서 지난 기록을 돌아봐요.", action: "오늘 컨디션을 알려주고, 끝낸 루틴을 체크해주세요.", detail: "수면·피로·가용시간이 바뀌면 추천도 조정돼요. 직접 만든 루틴과 이미 실천한 기록은 유지해요.", hint: "예시 루틴 하나를 체크해보세요", tag: "컨디션 체크 → 실천 → 리포트" },
];

export function ServiceWalkthrough({ step, onStepChange, onStart, resume }: { step: number; onStepChange: (step: number) => void; onStart: () => void; resume: boolean }) {
  const chapter = chapters[step];
  const Icon = chapter.icon;
  return <section className="service-guide" aria-label="ROUTINE FIT 사용 안내">
    <nav className="guide-nav" aria-label="사용 안내 단계">{chapters.map((item, index) => <button key={item.label} type="button" aria-current={index === step ? "step" : undefined} onClick={()=>onStepChange(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    <div className="guide-layout">
      <div className="guide-copy"><span className="guide-kicker"><Icon size={16}/>{chapter.tag}</span><h3 data-step-heading tabIndex={-1}>{chapter.title}</h3><p>{chapter.description}</p>
        <div className="guide-your-part"><span>나는 이렇게 하면 돼요</span><strong>{chapter.action}</strong><p>{chapter.detail}</p></div>
      </div>
      <div className="guide-visual"><div className="guide-example-label"><Sparkles size={14}/>미리 체험하는 예시 화면</div><WalkthroughPreview key={step} step={step}/><p className="guide-interaction-hint">{chapter.hint}</p></div>
    </div>
    <p className="guide-privacy"><ShieldCheck size={16}/><span>이 안내의 조작은 실제 답변·기록에 저장되지 않아요. 건강정보는 문진 마지막에 동의한 후 저장해요. 의료적 진단·처방은 제공하지 않아요.</span></p>
    <div className="guide-actions"><footer className="guide-footer"><button type="button" className="button secondary" onClick={()=>onStepChange(step - 1)} disabled={step === 0}><ArrowLeft size={16}/>이전</button><span aria-live="polite">{step + 1} / {chapters.length}</span>{step < chapters.length - 1 ? <button type="button" className="button primary" onClick={()=>onStepChange(step + 1)}>다음 안내<ArrowRight size={16}/></button> : <button type="button" className="button primary" onClick={onStart}>{resume ? "질문 이어가기" : "내 첫 질문 시작하기"}<ArrowRight size={16}/></button>}</footer>
    {step < chapters.length - 1 && <button type="button" className="guide-skip text-link" onClick={onStart}>{resume ? "설명을 닫고 질문 이어가기" : "설명은 건너뛰고 질문 시작하기"}</button>}
    </div>
  </section>;
}

function WalkthroughPreview({ step }: { step: number }) {
  const [choice, setChoice] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  if (step === 0) return <div className="guide-preview guide-personal">
    <svg className="guide-illustration" role="img" aria-label="수면, 식사와 움직임을 하나의 건강 루틴으로 연결하는 일러스트" viewBox="0 0 320 128"><path d="M50 75 Q160 5 270 75" fill="none" stroke="#e6b7af" strokeWidth="2" strokeDasharray="5 6"/><circle cx="160" cy="66" r="40" fill="#f9d5ce"/><path d="M142 59 C142 46 160 46 160 57 C160 46 178 46 178 59 C178 69 160 82 160 82 C160 82 142 69 142 59Z" fill="#e95658"/><circle cx="50" cy="75" r="23" fill="#fff"/><path d="M57 63 A12 12 0 1 0 62 82 A11 11 0 0 1 57 63" fill="#9a92bb"/><circle cx="270" cy="75" r="23" fill="#fff"/><path d="M260 81 Q255 64 282 63 Q282 85 260 81 M261 81 L274 70" fill="#d6e6ce" stroke="#78956b" strokeWidth="2"/></svg>
    <h4>어떤 일상을 만들고 싶나요?</h4><div className="guide-choice" aria-label="예시 건강 목표">{["잠을 편안하게", "몸을 가볍게"].map((label,index)=><button type="button" key={label} aria-pressed={choice === index} onClick={()=>setChoice(index)}>{label}</button>)}</div>
    <div className="guide-result" role="status"><span className="guide-result-icon">{choice === 0 ? <Moon size={21}/> : <Sun size={21}/>}</span><div><small>이런 루틴으로 시작해요 · 예시</small><strong>{choice === 0 ? "잠들기 전 화면에서 쉬기" : "식사 후 편안하게 걷기"}</strong></div><Check size={16}/></div>
  </div>;
  if (step === 1) return <div className="guide-preview guide-plan"><div className="guide-mode" aria-label="예시 계획 모드">{["핵심 루틴", "하루 전체"].map((label,index)=><button type="button" key={label} aria-pressed={choice === index} onClick={()=>setChoice(index)}>{label}</button>)}</div><h4>{choice === 0 ? "오늘, 이것만 해볼까요?" : "일정 사이에 나를 챙겨요"}</h4><div className="guide-day" role="status">{(choice === 0 ? [["식사·영양", "한 끼에 채소 더하기", "routine"], ["움직임", "편안하게 걷기", "routine"], ["스트레스", "잠시 호흡에 집중하기", "routine"]] : [["09:00", "수업 · 내가 등록한 일정", "fixed"], ["12:00", "점심 식사", "fixed"], ["12:30", "편안하게 걷기 · 추천 루틴", "routine"], ["14:00", "과제 · 내가 등록한 일정", "fixed"]]).map(([time,title,kind])=><div key={time} data-kind={kind}><span>{time}</span><strong>{title}</strong></div>)}</div><small className="guide-caption">{choice === 0 ? "추가 일정 입력 없이 가볍게 시작해요." : "주간 고정 일정 + 날짜별 약속을 함께 반영해요."}</small></div>;
  if (step === 2) return <div className="guide-preview guide-nutrition"><div className="guide-nutrition-card"><span className="guide-result-icon"><Utensils size={22}/></span><div><small>식습관 + 안전정보</small><h4>식품·영양성분 가이드</h4></div></div><div className="guide-nutrition-route"><span>안전 확인</span><ArrowRight size={14}/><span>성분 이해</span><ArrowRight size={14}/><span>iHerb 검색</span></div><div className="guide-inbody"><ScanLine size={26}/><strong>InBody, 있으면 더해요</strong><span>없어도 모든 기본 루틴을 시작할 수 있어요.</span><button type="button" className="button secondary" aria-expanded={choice === 1} onClick={()=>setChoice(choice === 1 ? 0 : 1)}>{choice === 1 ? "예시 접기" : "결과표 예시 확인하기"}</button>{choice === 1 && <div className="guide-body-values" role="status"><span>체중<b>60.0<small> kg</small></b></span><span>골격근량<b>24.0<small> kg</small></b></span><p>설명용 예시이며 권장 수치가 아니에요.<br/>인식된 수치는 직접 확인·수정한 뒤 저장해요.</p></div>}</div><small className="guide-caption">질환·복약 등 확인이 필요하면 구매 연결을 보류해요.</small></div>;
  const routines = ["잠깐 화면에서 쉬기", "한 끼에 채소 더하기", "편안하게 몸 풀기"];
  return <div className="guide-preview guide-check"><div className="guide-check-heading"><Heart size={18}/><h4>작은 실천도, 나의 기록</h4></div><div className="guide-checklist">{routines.map(label=><label key={label}><input type="checkbox" checked={checked.includes(label)} onChange={event=>setChecked(previous=>event.target.checked ? [...previous,label] : previous.filter(value=>value !== label))}/><span>{label}</span><Check size={15} aria-hidden="true"/></label>)}</div><div className="guide-progress" role="status"><span>오늘의 실천 <strong>{checked.length} / 3</strong></span><progress aria-label="예시 루틴 완료 수" max={3} value={checked.length}/><small>{checked.length ? "체크한 실천은 주간 리포트로 이어져요." : "하나를 눌러 실천을 기록해보세요."}</small></div></div>;
}
