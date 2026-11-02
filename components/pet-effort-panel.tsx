"use client";
import { PawPrint } from "lucide-react";
import { localDate } from "@/lib/model";
import { petEffortSummary } from "@/lib/pet-effort";
import type { PetResult } from "@/lib/pet-model";
import { PetAnimator } from "./pet-animator";

export function PetEffortPanel({pet,showCompanion=false}:{pet:PetResult;showCompanion?:boolean}){
  if(!pet.document||!pet.view)return null;
  const doc=pet.document,s=petEffortSummary(doc),view=pet.view;
  return <section className="pet-effort-panel" aria-label="나와 강아지가 쌓은 노력">
    {showCompanion&&doc.visible&&<div className="pet-effort-avatar"><PetAnimator baseState={view.baseState} reactionId={pet.reactionId} reducedMotion={doc.reducedMotion} name={doc.name}/></div>}
    <div className="pet-effort-body"><div className="pet-effort-heading"><PawPrint size={17}/><h3>오늘의 노력 · {doc.name}</h3><span>{localDate()} · 학습 Lv.{view.stats.learningLevel}</span></div>
    <div className="pet-effort-stats">{[{label:"확인한 실천",value:s.activities,unit:"개"},{label:"집중",value:s.focus,unit:"분"},{label:"움직임",value:s.movement,unit:"분"},{label:"휴식",value:s.rest,unit:"분"},{label:"업무",value:s.work,unit:"분"}].map(x=><div key={x.label}><small>{x.label}</small><b>{x.value}<span>{x.unit}</span></b></div>)}</div>
    <p>{s.message}</p><details><summary>최근 7일의 나와 비교하기</summary><p>{s.comparison}</p><div className="pet-effort-badges">{s.badges.map(b=><span key={b}>{b}</span>)}</div><small>완료·일부 수행을 실제 시간으로 확인한 활동만 집계해요. 연결된 루틴·일정은 한 번만 세고, 밤을 넘긴 시간은 날짜별로 나눠요. 앱에 남긴 기록이며 실제 능력·건강 평가가 아니에요.</small></details></div>
  </section>;
}
