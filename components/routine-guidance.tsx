import { BookOpen, ExternalLink, Leaf, Music2 } from "lucide-react";
import type { RoutineGuidance as Guidance } from "@/lib/model";

export function RoutineGuidance({guide}:{guide?:Guidance}) {
  if(!guide)return null;
  const Icon=guide.kind==="music"?Music2:guide.kind==="reading"?BookOpen:Leaf;
  return <details className={`routine-guidance ${guide.kind}`}>
    <summary><span className="guidance-heading"><Icon size={15} aria-hidden="true"/><strong>{guide.kind==="food"?"추천 식품과 영양정보":guide.kind==="music"?"추천 음악 장르와 이용 안내":"추천 독서 분야와 이용 안내"}</strong></span></summary>
    <div className="guidance-content">
    <p className="guidance-intro">{guide.intro}</p>
    {guide.items.length>0&&<ul>{guide.items.map(i=><li key={i.name}><b>{i.name}</b><span>{i.note}</span></li>)}</ul>}
      <p className="guidance-caution">{guide.caution}</p>
      {guide.sources.length>0&&<div className="guidance-sources">{guide.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ExternalLink size={11}/></a>)}</div>}
    </div>
  </details>;
}
