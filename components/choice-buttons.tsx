"use client";
import { useId } from "react";

export function ChoiceButtons({label,value,options,onChange,disabled=false}:{label:string;value:string;options:Record<string,string>;onChange:(value:string)=>void;disabled?:boolean}){
  const id=useId();
  return <div className="choice-field"><p id={id}>{label}</p><div className="choice-buttons" role="group" aria-labelledby={id}>{Object.entries(options).map(([key,text])=><button key={key} type="button" disabled={disabled} aria-pressed={value===key} className={value===key?"selected":""} onClick={()=>onChange(key)}>{text}</button>)}</div></div>;
}
