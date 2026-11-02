"use client";
import { useEffect,useRef,useState } from "react";
import { PetAnimator } from "./pet-animator";
import type { PetResult } from "@/lib/pet-model";

export function PetCelebration({pet}:{pet:PetResult|null}){
  const last=useRef<string|undefined>(undefined),[visible,setVisible]=useState(false);
  const reaction=pet?.reactionId;
  useEffect(()=>{
    if(!reaction)return;
    if(last.current!==reaction){last.current=reaction;setVisible(true);}
    const timer=setTimeout(()=>setVisible(false),3600);return()=>clearTimeout(timer);
  },[reaction]);
  if(!visible||!reaction||!pet?.document?.visible)return null;
  return <div className="pet-celebration" aria-hidden="true"><div><PetAnimator key={reaction} reactionId={reaction} celebrateOnMount reducedMotion={pet.document.reducedMotion} name={pet.document.name}/></div><span>{pet.document.name}<br/><b>작은 실천 하나!</b></span></div>;
}
