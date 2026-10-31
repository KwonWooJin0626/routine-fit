"use client";
import { useEffect,useRef,useState } from "react";

type Motion="idle"|"bark"|"happy"|"tired";
const config={idle:{inset:100,ms:150,frames:[0,1,2,3,4,5]},bark:{inset:100,ms:180,frames:[0,1,2,3,4,5]},happy:{inset:90,ms:140,frames:[0,1,2,3,4,5]},tired:{inset:64,ms:380,frames:[0,1,2,3,4,5,4,3,2,1]}};
const path="/pet/samoyed-puppy/aligned-v1";
export function PetAnimator({baseState="idle",reactionId,reducedMotion=false,name="사모예드"}:{baseState?:"idle"|"tired";reactionId?:string;reducedMotion?:boolean;name?:string}){
  const canvas=useRef<HTMLCanvasElement>(null),live=useRef({baseState,reactionId,reducedMotion}),lastReaction=useRef(reactionId),happyUntil=useRef(0);
  const [ready,setReady]=useState(false);live.current={baseState,reactionId,reducedMotion};
  useEffect(()=>{if(reactionId&&lastReaction.current!==reactionId)happyUntil.current=performance.now()+2520;lastReaction.current=reactionId;},[reactionId]);
  useEffect(()=>{
    const node=canvas.current;if(!node)return;const ctx=node.getContext("2d");if(!ctx)return;
    let active=true,raf=0,visible=true,lastFrame="",motion:Motion="idle",motionStart=0,nextBark=performance.now()+12000+Math.random()*10000,barkUntil=0;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)"),images={} as Record<Motion,HTMLImageElement>;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(node);
    const paint=(now:number)=>{
      if(!active)return;raf=requestAnimationFrame(paint);if(!visible||document.hidden)return;
      const reduced=live.current.reducedMotion||media.matches;
      let next:Motion=live.current.baseState;
      if(!reduced&&now<happyUntil.current)next="happy";
      else if(!reduced&&next==="idle"){
        if(now>=nextBark&&now>=barkUntil){barkUntil=now+1080;nextBark=barkUntil+12000+Math.random()*10000;}
        if(now<barkUntil)next="bark";
      }
      if(next!==motion){motion=next;motionStart=now;}
      const c=config[motion],frame=reduced?0:c.frames[Math.floor((now-motionStart)/c.ms)%c.frames.length],key=`${motion}:${frame}`;
      if(key===lastFrame)return;const img=images[motion];if(!img?.complete||!img.naturalWidth)return;lastFrame=key;
      ctx.clearRect(0,0,560,560);ctx.drawImage(img,(frame%3)*560+c.inset,Math.floor(frame/3)*560,560-c.inset,560,c.inset-560*.04,0,560-c.inset,560);
    };
    Promise.all((Object.keys(config) as Motion[]).map(state=>new Promise<void>((resolve,reject)=>{const img=new Image();images[state]=img;img.onload=()=>resolve();img.onerror=reject;img.src=`${path}/${state}.png`;}))).then(()=>{if(active){setReady(true);raf=requestAnimationFrame(paint);}}).catch(()=>{setReady(false);});
    return()=>{active=false;cancelAnimationFrame(raf);observer.disconnect();};
  },[]);
  return <div className="pet-stage"><img className={ready?"pet-poster ready":"pet-poster"} src={`${path}/poster-${baseState}.png`} alt=""/><canvas className={ready?"ready":""} ref={canvas} width={560} height={560} role="img" aria-label={`빨간 스카프를 두른 아기 사모예드 ${name} · ${baseState==="tired"?"쉬고 있어요":"꼬리를 흔들고 있어요"}`}/></div>;
}
