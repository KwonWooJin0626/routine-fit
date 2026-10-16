import { Activity, Coffee, Heart, Moon, RefreshCw } from "lucide-react";
import { analyze, metricStatus } from "@/lib/lifestyle-analysis";
import type { Answers } from "@/lib/model";
import { EvidenceSources } from "./evidence-sources";

const icons={sleep:Moon,food:Coffee,move:Activity,mind:Heart};
export function LifestyleAnalysis({answers,onEdit}:{answers:Answers;onEdit:()=>void}){
  const rows=analyze(answers);
  return <><div className="analysis-banner"><Activity size={24}/><div><h3>점수 대신, 내 응답과 근거를 함께 확인해요.</h3><p>공개 가이드라인 비교와 주관적 기록을 구분합니다. 질병·결핍 진단이나 종합 건강점수가 아닙니다.</p></div><button className="button secondary" onClick={onEdit}>문진 다시 하기<RefreshCw size={15}/></button></div>
    <div className="analysis-grid evidence-analysis">{rows.map(s=>{const Icon=icons[s.category];return <section key={s.category} className="panel analysis-card" aria-label={`${s.label} 근거 기반 분석`}><div className="analysis-top"><span className="routine-icon" data-category={s.category}><Icon size={23}/></span><span className="badge neutral">{s.label}</span></div><h2>{s.headline}</h2><p>{s.observation}</p><div className="analysis-verdict">{s.status}</div><dl className="analysis-metrics">{s.metrics.map(m=><div key={m.label}><dt>{m.label}<span className={`metric-status ${m.status}`}>{metricStatus[m.status]}</span></dt><dd><strong>{m.value}</strong><p>{m.reference}</p></dd></div>)}</dl><details className="analysis-limit"><summary>해석할 때 알아둘 점</summary><p>{s.limitation}</p></details><EvidenceSources ids={s.sources} note="자료는 기준·배경 설명용입니다. 공식 설문 원문을 시행하거나 진단한 결과는 아닙니다."/></section>;})}</div>
    <div className="note">새 질문에 답하지 않은 기존 기록은 ‘정보 부족’으로 표시합니다. 빈칸을 0이나 건강한 상태로 가정하지 않습니다.</div>
    <section className="panel assessment-scope"><h3>검증된 설문과 현재 서비스의 차이</h3><p>PSQI·PSS-10은 한국어판 및 이용 허가 확인 후 원문·채점법을 그대로 적용해야 합니다. NQ-2021도 일부 질문만으로 공식 점수를 만들지 않습니다. 현재는 이 도구들의 평가 영역과 한계를 참고한 자체 생활패턴 질문입니다.</p><EvidenceSources ids={["psqi","pss","nq"]} label="평가도구 자료 제목 보기"/></section>
  </>;
}
