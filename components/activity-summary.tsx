"use client";
import { activityAllocation, activityDomains, activityGoals, activityWhen, dayNames, orderedDays, type ActivityProfile } from "@/lib/activity-profile";
import { activityDefinition } from "@/lib/activity-catalog";

export function ActivitySummary({profile:p,compact=false}:{profile:ActivityProfile;compact?:boolean}){
  const a=activityDefinition(p);
  return <div className="activity-summary"><b>{activityDomains[p.domain]} · {a?.title??"활동 선택 필요"}</b><p>{activityGoals[p.domain][p.goal]} · 활동일 최대 {p.daily}분 · {p.weekly===null?"주간 목표 없이":`주 ${p.weekly}분`}</p>{p.fields.deadline&&<p>마감: {p.fields.deadline}</p>}<p>{orderedDays.filter(d=>p.days.includes(d)).map(d=>`${dayNames[d]} ${activityAllocation(p)[d]}분`).join(" · ")} · {activityWhen[p.when]}</p>{!compact&&<small>이 시간은 희망·예정 분량이에요. 실제 실천과 별도로 기록해요.</small>}</div>;
}
