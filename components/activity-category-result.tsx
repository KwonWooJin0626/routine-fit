"use client";
import type { Day } from "@/lib/model";
import { localDate } from "@/lib/model";
import { activityDomains, activityGoals, type ActivityDomain, type ActivityProfile } from "@/lib/activity-profile";
import { exerciseAdjustment } from "@/lib/activity-catalog";
import { activityMinutesOn, activityRoutine } from "@/lib/activity-recommendations";
import { Dialog } from "./forms";
import { ActivitySummary } from "./activity-summary";

export function ActivityCategoryResult({profile:p,day,pending,busy,onClose,onEdit}:{profile:ActivityProfile;day:Day;pending:ActivityDomain[];busy:boolean;onClose:()=>void;onEdit:()=>void}){
  const adjustment=exerciseAdjustment(p),today=localDate(),scheduled=activityMinutesOn(p,today);
  const expected=activityRoutine(p,Math.min(p.daily,day.checkin.minutes));
  const saved=day.routines.find(r=>r.id===expected.id),routine=saved??expected;
  const isDone=!!saved&&!!day.statuses[saved.id];
  return <Dialog title={`${activityDomains[p.domain]} 설문을 마쳤어요`} subtitle="이 분야의 답변·목표와 다음 설문 진행 순서를 저장했어요." onClose={onClose}>
    <div className="activity-category-result"><div className="activity-result-content">
      <span className="activity-result-status">설문 완료 · 활동 실천 완료와는 달라요</span>
      <h3>{activityGoals[p.domain][p.goal]}에 맞춘 첫 제안</h3>
      {adjustment.level!=="normal"&&<div className="activity-adjust" role="status"><b>{adjustment.level==="hold"?"답변 저장 완료 · 운동 실행 추천은 보류":"피하고 싶은 동작을 반영했어요"}</b><p>{adjustment.level==="hold"?"목표와 불편한 동작은 저장했어요. 실행은 보류하고 준비 활동부터 제안해요.":"뛰기·점프를 제외하는 방식을 제안해요."}</p><details><summary>조정 이유 자세히 보기</summary><p>{adjustment.message}</p></details></div>}
      <article className="activity-result-card"><small>{saved?saved.held?"오늘의 루틴에 보류 상태로 반영했어요 · 실행 전 조건을 확인해주세요":isDone?"이미 남긴 오늘의 실천 기록을 유지했어요":"오늘의 루틴에 반영했어요":!scheduled?"오늘은 선택한 실행 요일이 아니에요 · 다음 활동 예시":"오늘의 컨디션·시간에 따라 추가 배치하지 않은 활동 예시"}</small><h4>{routine.title}</h4><p>{adjustment.level==="hold"?routine.detail.replace(adjustment.message,"").trim():routine.detail}</p><b>{routine.activity?.linkedEvent?"기존 일정과 연결 · 중복 시간 추가 없음":`${routine.minutes}분 · ${routine.when}`}</b><details><summary>이렇게 추천한 이유</summary><p>{routine.reason}</p><p>어렵다면: {routine.fallback}</p></details></article>
      <details className="question-help"><summary>저장한 목표·요일 확인</summary><ActivitySummary profile={p} compact/></details>
      <div className="activity-next-note">{pending.length?<><b>다음은 {activityDomains[pending[0]]}예요.</b><p>홈의 ‘{activityDomains[pending[0]]} 질문 이어하기’로 나중에 진행해요.</p></>:<><b>선택한 분야의 설문을 모두 마쳤어요.</b><p>루틴을 실천하고 체크해보세요. 목표·활동은 나중에 수정할 수 있어요.</p></>}</div>
      </div><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onEdit}>이 분야 수정</button><button type="button" className="button primary" disabled={busy} onClick={onClose}>루틴으로 돌아가기</button></div>
    </div>
  </Dialog>;
}
