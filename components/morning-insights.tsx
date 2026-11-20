"use client";
import { morningAdvice } from "@/lib/morning-insights";
import type { MorningRecord } from "@/lib/morning-model";
import { FeaturePanel } from "./feature-panel";

export function MorningInsights({rows,date,onCheckin,onPlan}:{rows:MorningRecord[];date:string;onCheckin:()=>void;onPlan:()=>void}){
  const data=morningAdvice(rows,date);
  if(!data)return <section className="panel">
    <h3>기상 후 컨디션</h3>
    <p>오늘의 느낌과 어젯밤 수면을 남기면 전날 활동과 함께 살펴봐요.</p>
    <button type="button" className="text-link" onClick={onCheckin}>컨디션 기록하기</button>
  </section>;
  return <FeaturePanel title="내 아침 컨디션과 오늘의 제안" emoji="🌤️"
    caption={`컨디션 ${data.current.energy}/5 · ${data.suggestions[0]}`}>
    <ul>{data.suggestions.map(text=><li key={text}>{text}</li>)}</ul>
    <div className="record-table"><table>
      <caption>이번 기상 기록에 연결한 전날 정보</caption>
      <thead><tr><th scope="col">항목</th><th scope="col">기록</th></tr></thead>
      <tbody>
        <tr><th scope="row">어젯밤 수면</th><td>{data.current.sleepHours===null?"미기록":`${Number(data.current.sleepHours.toFixed(1))}시간 · ${data.current.sleepSource==="reported"?"기상 체크":"실제 수면 기록"}`}</td></tr>
        <tr><th scope="row">체감 정신 부담</th><td>{data.current.previousMental===null?"미기록":`${data.current.previousMental.toFixed(1)}/5 · ${Math.round(data.current.previousMentalMinutes)}분 기록`}</td></tr>
        <tr><th scope="row">체감 육체 피로</th><td>{data.current.previousPhysical===null?"미기록":`${data.current.previousPhysical.toFixed(1)}/5 · ${Math.round(data.current.previousPhysicalMinutes)}분 기록`}</td></tr>
        <tr><th scope="row">강아지 체력 / 스트레스</th><td>{data.current.petStamina===null?"미기록":`${data.current.petStamina.toFixed(1)} / ${data.current.petStress?.toFixed(1)}점`}</td></tr>
        <tr><th scope="row">전날 운동 / 집중 / 휴식</th><td>{Math.round(data.current.previousExercise)} / {Math.round(data.current.previousFocus)} / {Math.round(data.current.previousRest)}분</td></tr>
      </tbody>
    </table></div>
    {data.patterns.length?<><h3>컨디션이 좋았던 아침에 함께 나타난 범위</h3>
      <ul>{data.patterns.map(row=><li key={row.label}>{row.label} <b>{row.value}</b> · {row.count}일 참고</li>)}</ul>
      <p className="muted">이전에 기록한 아침 중 상쾌했던 날의 가운데 50% 범위예요. 컨디션을 좋게 만든 원인이나 권장 목표량은 추가 기록과 함께 살펴봐요.</p>
    </>:<p>이전 기상 기록 {data.historyCount}일 · 상쾌했던 기록 {data.goodCount}일이 있어요. 이전 기록 7일 이상과 상쾌했던 날 3일 이상이 모이면 반복된 범위를 보여줘요.</p>}
    {data.similarEnergy!==null&&<p>수면과 전날 부담이 비슷했던 이전 {data.similarCount}일의 아침 컨디션은 평균 <b>{data.similarEnergy.toFixed(1)}/5</b>였어요.</p>}
    <p className="muted">활동 시간은 실제 수행을 확인한 기록만 포함해요. 전날 정보는 기상 기록 시점에 보관해요. 강아지 수치는 게임 안의 변화예요. 같은 날 컨디션을 다시 저장하면 연결 정보도 갱신돼요.</p>
    <div className="dialog-actions">
      <button type="button" className="button secondary" onClick={onCheckin}>컨디션 수정</button>
      <button type="button" className="button secondary" onClick={onPlan}>오늘 계획에서 조절하기</button>
    </div>
  </FeaturePanel>;
}
