import { ExternalLink } from "lucide-react";
import { evidence, questionEvidence, routineEvidence, type EvidenceId } from "@/lib/evidence";
import type { Routine } from "@/lib/model";

export function EvidenceSources({ids,note,label="참고 자료",internalTitle="서비스 자체 질문·제안 · 외부 근거 없음"}:{ids:readonly EvidenceId[];note?:string;label?:string;internalTitle?:string}){
  return <details className="evidence-sources"><summary>{label}</summary><div className="evidence-content">{ids.length>0?<ul>{[...new Set(ids)].map(id=><li key={id}><a href={evidence[id].url} target="_blank" rel="noopener noreferrer">{evidence[id].title}<ExternalLink size={12} aria-hidden="true"/></a></li>)}</ul>:<p className="source-internal">{internalTitle}</p>}{note&&<details className="source-context"><summary>적용 범위</summary><p>{note}</p></details>}</div></details>;
}
export function QuestionSources({question}:{question?:string}){const info=questionEvidence(question??"service");return <EvidenceSources {...info}/>;}
export function RoutineSources({routine}:{routine:Routine}){return <EvidenceSources {...routineEvidence(routine)} internalTitle={routine.source==="custom"||routine.id.startsWith("custom-")?"내가 직접 만든 루틴 · 외부 근거 미검증":undefined}/>;}
