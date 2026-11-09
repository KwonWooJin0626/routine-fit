"use client";
import { useState,type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog } from "./forms";

/** The same content is mounted in a native modal only when requested. */
export function FeaturePanel({title,caption,emoji,children,unavailable=false}:{title:string;caption:string;emoji?:string;children:ReactNode;unavailable?:boolean}){
  const [opened,setOpened]=useState(false);
  return <div className="feature-panel">
    <button type="button" className="feature-action" aria-haspopup="dialog" aria-expanded={opened&&!unavailable} onClick={()=>setOpened(true)}>
      {emoji&&<span className="feature-emoji" aria-hidden="true">{emoji}</span>}
      <span className="feature-copy"><strong>{title}</strong><small>{caption}</small></span><ChevronRight size={18} aria-hidden="true"/>
    </button>
    {opened&&!unavailable&&<Dialog title={title} subtitle={caption} wide onClose={()=>setOpened(false)}>
      <div className="feature-body">{children}</div>
      <footer className="feature-footer"><button type="button" className="button secondary" onClick={()=>setOpened(false)}>닫기</button></footer>
    </Dialog>}
  </div>;
}
