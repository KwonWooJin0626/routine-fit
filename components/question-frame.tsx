"use client";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog } from "./forms";

export function QuestionFrame({step,total,title,hint,children,onBack,onNext,onClose,busy,error,nextLabel="다음",disabled=false}:{step:number;total:number;title:string;hint:string;children:ReactNode;onBack?:()=>void;onNext:()=>void;onClose:()=>void;busy?:boolean;error?:string;nextLabel?:string;disabled?:boolean}){
  return <Dialog title="작게 시작하는 나의 루틴" onClose={onClose} resetKey={step}>
    <form className="question-frame" onSubmit={e=>{e.preventDefault();if(!disabled&&!busy)onNext();}}>
      <div className="question-progress"><span>질문 {step+1} / {total}</span><progress value={step+1} max={total} aria-label="질문 진행"/></div>
      <div className="question-body"><h3 data-step-heading tabIndex={-1}>{title}</h3><p className="question-hint">{hint}</p>{children}</div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="question-footer"><span>{onBack?<button type="button" className="button secondary" disabled={busy} onClick={onBack}><ArrowLeft size={15}/>이전</button>:"필요한 정보만, 차근차근"}</span><button type="submit" className="button primary" disabled={busy||disabled}>{busy?"저장 중…":nextLabel}<ArrowRight size={15}/></button></div>
    </form>
  </Dialog>;
}
