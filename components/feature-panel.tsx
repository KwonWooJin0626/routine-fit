"use client";
import { useState,type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog } from "./forms";

type ActionProps={title:string;caption:string;emoji?:string;onClick:()=>void;expanded?:boolean};

export function FeatureAction({title,caption,emoji,onClick,expanded}:ActionProps){
  return <button type="button" className="feature-action" aria-haspopup={expanded!==undefined?"dialog":undefined} aria-expanded={expanded} onClick={onClick}>
      {emoji&&<span className="feature-emoji" aria-hidden="true">{emoji}</span>}
      <span className="feature-copy"><strong>{title}</strong><small>{caption}</small></span><ChevronRight size={18} aria-hidden="true"/>
    </button>
}

/** The same content is mounted in a native modal only when requested. */
export function FeaturePanel({title,caption,emoji,children,unavailable=false,sheet=false}:Omit<ActionProps,"onClick"|"expanded">&{children:ReactNode;unavailable?:boolean;sheet?:boolean}){
  const [opened,setOpened]=useState(false);
  return <div className="feature-panel">
    <FeatureAction title={title} caption={caption} emoji={emoji} expanded={opened&&!unavailable} onClick={()=>setOpened(true)}/>
    {opened&&!unavailable&&<Dialog title={title} subtitle={caption} wide className={sheet?"settings-sheet":undefined} onClose={()=>setOpened(false)}>
      <div className="feature-body">{children}</div>
      <footer className="feature-footer"><button type="button" className="button secondary" onClick={()=>setOpened(false)}>닫기</button></footer>
    </Dialog>}
  </div>;
}
