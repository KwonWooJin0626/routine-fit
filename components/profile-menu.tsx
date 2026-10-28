"use client";
import { useId,useLayoutEffect,useEffect,useRef,useState,type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Settings,UserRound,Download,RotateCcw,LogOut,ChevronUp } from "lucide-react";
import { AccountSignOut } from "./account-sign-out";

type Props={name:string;email?:string;placement:"header"|"sidebar";open:boolean;busy:boolean;demo:boolean;onOpenChange:(open:boolean)=>void;onSettings:()=>void;onProfile:()=>void;onExport:()=>void;onReset:()=>void;onExitDemo:()=>void};
export function ProfileMenu({name,email,placement,open,busy,demo,onOpenChange,onSettings,onProfile,onExport,onReset,onExitDemo}:Props){
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),initialFocus=useRef<"first"|"last">("first"),focused=useRef(false);
  const [position,setPosition]=useState<{top:number;left:number}|null>(null);
  const dismiss=()=>onOpenChange(false);
  useLayoutEffect(()=>{
    if(!open||!trigger.current||!menu.current)return;
    const place=()=>{
      if(!trigger.current||!menu.current)return;
      const rect=trigger.current.getBoundingClientRect(),popup=menu.current.getBoundingClientRect(),gap=10,padding=12;
      const left=Math.max(padding,Math.min(placement==="header"?rect.right-popup.width:rect.left,window.innerWidth-popup.width-padding));
      const preferred=placement==="sidebar"?rect.top-popup.height-gap:rect.bottom+gap;
      const alternate=placement==="sidebar"?rect.bottom+gap:rect.top-popup.height-gap;
      const top=Math.max(padding,Math.min(preferred>=padding&&preferred+popup.height<=window.innerHeight-padding?preferred:alternate,window.innerHeight-popup.height-padding));
      setPosition({top,left});
    };
    place();
    window.addEventListener("resize",place);return()=>window.removeEventListener("resize",place);
  },[open,placement]);
  useLayoutEffect(()=>{
    if(!open){focused.current=false;return;}
    if(!position||focused.current||!menu.current)return;
    focused.current=true;const items=menu.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    (initialFocus.current==="last"?items[items.length-1]:items[0])?.focus({preventScroll:true});
  },[open,position]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!trigger.current?.contains(event.target)&&!menu.current?.contains(event.target))onOpenChange(false);};
    const scroll=(event:Event)=>{if(event.target instanceof Node&&menu.current?.contains(event.target))return;onOpenChange(false);};
    document.addEventListener("pointerdown",outside);document.addEventListener("scroll",scroll,true);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("scroll",scroll,true);};
  },[open,onOpenChange]);
  function keyDown(event:KeyboardEvent<HTMLDivElement>){
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();dismiss();trigger.current?.focus({preventScroll:true});return;}
    if(event.key==="Tab"){trigger.current?.focus({preventScroll:true});dismiss();return;}
    if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
    event.preventDefault();const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')??[]);if(!items.length)return;
    const index=items.findIndex(item=>item===document.activeElement);
    const next=event.key==="Home"?0:event.key==="End"?items.length-1:event.key==="ArrowDown"?(index+1)%items.length:(index-1+items.length)%items.length;
    items[next]?.focus();
  }
  const choose=(action:()=>void)=>{if(busy)return;dismiss();trigger.current?.focus({preventScroll:true});action();};
  return <>
    <button type="button" ref={trigger} className={`profile-trigger profile-trigger-${placement}`} aria-label={placement==="header"?"상단 계정 메뉴":"왼쪽 프로필 메뉴"} title="계정 메뉴" aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} disabled={busy} onClick={()=>{initialFocus.current="first";setPosition(null);onOpenChange(!open);}} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();initialFocus.current=event.key==="ArrowUp"?"last":"first";if(open){const items=menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');(initialFocus.current==="last"?items?.[items.length-1]:items?.[0])?.focus({preventScroll:true});}else{setPosition(null);onOpenChange(true);}}}}>
      <span className={`avatar ${placement==="header"?"small":""}`} aria-hidden="true">{name.slice(0,1)}</span>
      {placement==="sidebar"&&<><span className="profile-trigger-copy"><strong>{name}님</strong><small>{demo?"예시 체험 중":"나의 성장 기록"}</small></span><ChevronUp size={16} aria-hidden="true"/></>}
    </button>
    {open&&createPortal(<div id={id} ref={menu} role="menu" aria-label="계정 메뉴" className="profile-menu" onKeyDown={keyDown} style={{top:position?.top??0,left:position?.left??0,visibility:position?"visible":"hidden"}}>
      <div className="profile-menu-identity" role="presentation"><span className="avatar" aria-hidden="true">{name.slice(0,1)}</span><div><strong>{name}님</strong><small>{demo?"예시 체험 · 계정 데이터에 영향 없음":email||"나의 계정"}</small></div></div>
      <button type="button" role="menuitem" disabled={busy} onClick={()=>choose(onSettings)}><Settings size={17}/>설정</button>
      <button type="button" role="menuitem" disabled={busy} onClick={()=>choose(onProfile)}><UserRound size={17}/>기초 프로필 수정</button>
      <button type="button" role="menuitem" disabled={busy} onClick={()=>choose(onExport)}><Download size={17}/>내 데이터 내려받기</button>
      <div className="profile-menu-divider" role="separator"/>
      <button type="button" role="menuitem" className="profile-menu-danger" disabled={busy} onClick={()=>choose(onReset)}><RotateCcw size={17}/>{demo?"체험 데이터 초기화":"내 데이터 초기화"}</button>
      {demo?<button type="button" role="menuitem" disabled={busy} onClick={()=>choose(onExitDemo)}><LogOut size={17}/>체험 종료</button>:<AccountSignOut role="menuitem" disabled={busy}><LogOut size={17}/>로그아웃</AccountSignOut>}
    </div>,document.body)}
  </>;
}
