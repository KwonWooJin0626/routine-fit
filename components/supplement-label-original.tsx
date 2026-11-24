import type { SupplementLabel } from "@/lib/supplement-label";

export function SupplementLabelOriginal({label}:{label:SupplementLabel}){
  return <details><summary>성분 원문 보기</summary><p className="muted">가져온 이름과 함량을 확인해요. 예전 기록에 원문이 없으면 저장된 이름으로 표시해요.</p>
    <ul>{label.facts.map((f,i)=><li key={i}>{f.rawName??f.name}: {f.rawAmount??f.amount} {f.rawUnit??f.unit}</li>)}</ul>
  </details>;
}
