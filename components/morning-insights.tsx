"use client";
import { useState } from "react";
import { Dialog } from "./forms";
import type { AppState } from "@/lib/model";
import { morningProposals,type MorningProposal } from "@/lib/morning-proposals";
import { morningAdvice } from "@/lib/morning-insights";
import type { MorningRecord } from "@/lib/morning-model";
import { FeaturePanel } from "./feature-panel";

export function MorningInsights({state,rows,date,onCheckin,onPlan,busy,onAction,unavailable}:{unavailable?:boolean;state:AppState;rows:MorningRecord[];date:string;onCheckin:()=>void;onPlan:()=>void;busy:boolean;onAction:(p:MorningProposal,action:"accept"|"dismiss")=>Promise<void>}){
  const [preview,setPreview]=useState<MorningProposal|null>(null),[error,setError]=useState("");
  const act=async(p:MorningProposal,action:"accept"|"dismiss")=>{setError("");try{await onAction(p,action);setPreview(null);}catch(e){setError((e as Error).message);}};
  const data=morningAdvice(rows,date);
  if(!data)return <section className="panel">
    <h3>기상 후 컨디션</h3>
    <p>오늘의 느낌과 어젯밤 수면을 남기면 전날 활동과 함께 살펴봐요.</p>
    <button type="button" className="text-link" onClick={onCheckin}>컨디션 기록하기</button>
  </section>;
  return <FeaturePanel unavailable={unavailable} title="내 아침 컨디션과 오늘의 제안" emoji="🌤️"
    caption={`컨디션 ${data.current.energy}/5 · ${data.suggestions[0]}`}>
    <ul>{data.suggestions.slice(0,3).map(text=><li key={text}>{text}</li>)}</ul>
    <div className="morning-proposals">{morningProposals(state,data.current).map(p=><article className="panel" key={p.id}><h3>{p.title}</h3><p>{p.reason}</p><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>p.blockId?setPreview(p):void act(p,"accept")}>{p.blockId?"변경 미리보기":"오늘에 담기"}</button><button type="button" className="text-link" disabled={busy} onClick={()=>void act(p,"dismiss")}>오늘은 넘기기</button></div></article>)}</div>
    {error&&<p role="alert">{error}</p>}
    {preview&&<Dialog title="오늘 일정 변경 미리보기" subtitle="선택한 날짜의 일정 한 번에만 반영해요." onClose={()=>{if(!busy)setPreview(null);}}><h3>{preview.title}</h3><p>변경 전: {preview.before}</p><p>변경 후: {preview.after}</p><p>{preview.reason}</p><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setPreview(null)}>취소</button><button type="button" className="button primary" disabled={busy} onClick={()=>void act(preview,"accept")}>이 변경 적용</button></div>{error&&<p role="alert">{error}</p>}</Dialog>}
    <div className="record-table"><table>
      <caption>이번 기상 기록에 연결한 전날 정보</caption>
      <thead><tr><th scope="col">항목</th><th scope="col">기록</th></tr></thead>
      <tbody>
        <tr><th scope="row">연결 상태 기준</th><td>{({sleep:"실제 취침 직전",activity:"마지막 실제 활동 직후",midnight:"전날 자정"} as const)[data.current.snapshotBasis??"midnight"]}{data.current.snapshotAt?" · "+new Date(data.current.snapshotAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):""}</td></tr>
        <tr><th scope="row">어젯밤 수면</th><td>{data.current.sleepHours===null?"미기록":`${Number(data.current.sleepHours.toFixed(1))}시간 · ${data.current.sleepSource==="reported"?"기상 체크":"실제 수면 기록"}`}</td></tr>
        <tr><th scope="row">체감 정신 부담</th><td>{data.current.previousMental===null?"미기록":`${data.current.previousMental.toFixed(1)}/5 · ${Math.round(data.current.previousMentalMinutes)}분 기록`}</td></tr>
        <tr><th scope="row">체감 육체 피로</th><td>{data.current.previousPhysical===null?"미기록":`${data.current.previousPhysical.toFixed(1)}/5 · ${Math.round(data.current.previousPhysicalMinutes)}분 기록`}</td></tr>
        <tr><th scope="row">높은 정신 부담 / 육체 피로 시간</th><td>{data.current.highMentalMinutes===undefined?"미집계":Math.round(data.current.highMentalMinutes)+"분"} / {data.current.highPhysicalMinutes===undefined?"미집계":Math.round(data.current.highPhysicalMinutes)+"분"}</td></tr>
        <tr><th scope="row">야간 실제 활동 (22~06시)</th><td>{data.current.lateMinutes===undefined?"미집계":Math.round(data.current.lateMinutes)+"분"}</td></tr>
        <tr><th scope="row">강아지 체력 / 스트레스</th><td>{data.current.petStamina===null?"미기록":`${data.current.petStamina.toFixed(1)} / ${data.current.petStress?.toFixed(1)}점`}</td></tr>
        <tr><th scope="row">취침 전 24시간 운동 / 집중 / 휴식</th><td>{Math.round(data.current.previousExercise)} / {Math.round(data.current.previousFocus)} / {Math.round(data.current.previousRest)}분</td></tr>
      </tbody>
    </table></div>
    {data.patterns.length?<><h3>컨디션이 좋았던 아침에 함께 나타난 범위</h3>
      <ul>{data.patterns.map(row=><li key={row.label}>{row.label} <b>{row.value}</b> · {row.count}일 참고</li>)}</ul>
      <p className="muted">이전에 기록한 아침 중 상쾌했던 날의 가운데 50% 범위예요. 컨디션을 좋게 만든 원인이나 권장 목표량은 추가 기록과 함께 살펴봐요.</p>
    </>:<p>이전 기상 기록 {data.historyCount}일 · 상쾌했던 기록 {data.goodCount}일이 있어요. 이전 기록 7일 이상과 상쾌했던 날 3일 이상이 모이면 반복된 범위를 보여줘요.</p>}
    {data.similarEnergy!==null&&<p>수면·실제 부담과 회복 기록이 비슷했던 이전 {data.similarCount}일의 아침 컨디션은 평균 <b>{data.similarEnergy.toFixed(1)}/5</b>였어요.</p>}
    {data.distribution?<p>비슷했던 아침 중 상쾌 {data.distribution.good}일 · 보통 {data.distribution.normal}일 · 피곤 {data.distribution.tired}일이에요.</p>:<p className="muted">비슷한 날 비교는 이전 기록 14일 이상과 수면·실제 부담이 비슷한 기록 5일 이상에서 제공해요.</p>}
    <p className="muted">일정 상세에서 고정·이동 가능·시간 조절 가능을 정할 수 있어요. 선택한 제안과 완료 기록은 다음 제안 순서에 반영돼요. 컨디션 변화와의 관계는 기록이 쌓이면 함께 살펴봐요.</p>
    <p className="muted">활동 시간은 실제 수행을 확인한 기록만 포함해요. 전날 정보는 기상 기록 시점에 보관해요. 강아지 수치는 게임 안의 변화예요. 같은 날 컨디션을 다시 저장하면 연결 정보도 갱신돼요.</p>
    <div className="dialog-actions">
      <button type="button" className="button secondary" onClick={onCheckin}>컨디션 수정</button>
      <button type="button" className="button secondary" onClick={onPlan}>오늘 계획에서 조절하기</button>
    </div>
  </FeaturePanel>;
}
