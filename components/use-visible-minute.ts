"use client";
import { useEffect,useState } from "react";
export function useVisibleMinute(){
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{
    let timer:ReturnType<typeof setInterval>|undefined;
    const sync=()=>{if(timer)clearInterval(timer);if(document.visibilityState==="visible"){setNow(new Date());timer=setInterval(()=>setNow(new Date()),60000);}};
    sync();document.addEventListener("visibilitychange",sync);
    return()=>{if(timer)clearInterval(timer);document.removeEventListener("visibilitychange",sync);};
  },[]);
  return now;
}
