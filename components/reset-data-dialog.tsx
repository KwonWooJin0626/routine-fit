"use client";
import { useState } from "react";
import { Download,RotateCcw } from "lucide-react";
import { Dialog } from "./forms";

export function ResetDataDialog({demo,busy,error,onClose,onExport,onConfirm}:{demo:boolean;busy:boolean;error:string;onClose:()=>void;onExport:()=>void;onConfirm:()=>void}){
  const [confirmed,setConfirmed]=useState(false);
  return <Dialog title={demo?"체험 데이터를 초기화할까요?":"내 데이터를 초기화할까요?"} subtitle={demo?"체험 중 바꾼 내용만 지우고 처음 예시로 돌아가요.":"로그인 계정은 유지하고, 저장된 데이터를 지운 뒤 첫 질문부터 다시 시작해요."} onClose={onClose}>
    <div className="reset-data-scope"><h3>{demo?"초기화되는 체험 내용":"삭제되는 데이터"}</h3><ul><li>기초·심화 설문과 프로필, 영양·음식 정보</li><li>주간·하루 계획, 블록 보관함, 직접 만든 루틴</li><li>루틴·일정 실천 기록과 한 줄 회고</li><li>InBody 기록, 수면 체크인과 수면 알림 설정</li></ul><p>{demo?"로그인한 계정에 저장된 데이터는 삭제하지 않아요.":"삭제한 데이터는 되돌릴 수 없어요. 수면 메일 알림도 중지됩니다. 필요한 기록은 먼저 내려받아주세요."}</p></div>
    <button type="button" className="text-link" disabled={busy} onClick={onExport}><Download size={15}/>초기화 전에 내 데이터 내려받기</button>
    <label className="check-choice reset-data-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>{demo?"체험 데이터만 초기화하는 것을 확인했어요.":"삭제 범위와 복구할 수 없다는 점을 확인했어요."}</label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>취소</button><button type="button" className="button danger" disabled={busy||!confirmed} onClick={()=>{if(confirmed&&!busy)onConfirm();}}><RotateCcw size={16}/>{busy?"처리 중…":demo?"체험 데이터 초기화":"확인한 데이터 초기화"}</button></div>
  </Dialog>;
}
