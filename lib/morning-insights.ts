import { localDate,type AppState,type Checkin } from "./model";
import { addDate } from "./planner";
import { actualTimeSpans,plannedLoad } from "./lifestyle-charts";
import { humanDocument } from "./activity-journal";
import { calculatePet } from "./pet-engine";
import type { PetDocument } from "./pet-model";
import type { MorningRecord } from "./morning-model";
import { executionSegments } from "./pet-execution";

export function captureMorning(state:AppState,checkin:Checkin,pet:PetDocument|null,now=new Date()):MorningRecord|null{
  if(!checkin.morning||!checkin.energyKnown||!checkin.reported)return null;
  const date=localDate(now),previous=addDate(date,-1),midnight=Date.parse(date+"T00:00:00+09:00");
  const doc=humanDocument(state,pet),spans=actualTimeSpans(state,previous,pet);
  // Only experienced scores qualify for the personal pattern, never projected plan scores.
  const load=plannedLoad(spans);
  const minutes=(categories:string[])=>spans.filter(span=>categories.includes(span.category))
    .reduce((total,span)=>total+span.until-span.from,0);
  const sleeps=doc.records.filter(record=>record.type==="sleep"&&!record.cancelled&&
    Date.parse(record.end)<=now.getTime()&&localDate(new Date(record.end))===date);
  const sleepMinutes=sleeps.reduce((total,record)=>total+executionSegments(record).reduce((sum,segment)=>
    sum+Math.max(0,segment.end-Math.max(now.getTime()-24*3600000,segment.start))/60000,0),0);
  const reported=checkin.sleepKnown===true;
  const petState=pet&&Date.parse(pet.seed.at)<=midnight?calculatePet(pet,new Date(midnight)).stats:null;
  return {date,recordedAt:now.toISOString(),energy:checkin.energy,unwell:checkin.unwell,
    sleepHours:reported?checkin.sleep:sleeps.length?Math.min(24,sleepMinutes/60):null,
    sleepSource:reported?"reported":sleeps.length?"recorded":"unknown",
    previousMental:load.mental,previousPhysical:load.physical,
    previousMentalMinutes:load.mentalMinutes,previousPhysicalMinutes:load.physicalMinutes,
    previousActivityMinutes:Math.min(1440,minutes(spans.map(s=>s.category))),
    previousExercise:Math.min(1440,minutes(["exercise"])),
    previousFocus:Math.min(1440,minutes(["study","task","work","growth"])),
    previousRest:Math.min(1440,minutes(["rest","leisure"])),
    petStamina:petState?.stamina??null,petStress:petState?.stress??null};
}

export function withMorning(state:AppState,record:MorningRecord|null):AppState{
  if(!record)return state;
  return {...state,morningRecords:[...(state.morningRecords??[]).filter(row=>row.date!==record.date),record]
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(-90)};
}

export function morningAdvice(rows:MorningRecord[],date:string){
  const current=rows.find(row=>row.date===date);
  if(!current)return null;
  const past=rows.filter(row=>row.date<date).sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
  const good=past.filter(row=>row.energy>=4&&!row.unwell);
  const range=(get:(row:MorningRecord)=>number|null,unit:string)=>{
    const values=good.map(get).filter((v):v is number=>v!==null).sort((a,b)=>a-b);
    if(values.length<3)return null;
    const low=values[Math.floor((values.length-1)*.25)],high=values[Math.ceil((values.length-1)*.75)];
    const format=(n:number)=>Number(n.toFixed(1));
    return {value:low===high?`${format(low)}${unit}`:`${format(low)}~${format(high)}${unit}`,count:values.length};
  };
  const patterns=past.length>=7&&good.length>=3?[
    {label:"수면",...range(row=>row.sleepHours,"시간")},
    {label:"전날 체감 정신 부담",...range(row=>row.previousMental,"/5")},
    {label:"전날 체감 육체 피로",...range(row=>row.previousPhysical,"/5")},
    {label:"전날 강아지 스트레스",...range(row=>row.petStress,"점")},
    {label:"전날 강아지 체력",...range(row=>row.petStamina,"점")},
  ].filter(row=>row.value):[];
  const tired=current.energy<=2||current.unwell;
  const highMental=(current.previousMental??0)>=4||(current.petStress??0)>=80;
  const highPhysical=(current.previousPhysical??0)>=4||(current.petStamina!==null&&current.petStamina<=30);
  const similar=past.filter(row=>{
    if(row.sleepHours===null||current.sleepHours===null)return false;
    const distances=[Math.abs(row.sleepHours-current.sleepHours)/4];
    for(const axis of ["previousMental","previousPhysical"] as const){
      if(row[axis]!==null&&current[axis]!==null)distances.push(Math.abs(row[axis]!-current[axis]!)/4);
    }
    return distances.length>=2&&distances.reduce((sum,n)=>sum+n,0)/distances.length<=.2;
  });
  const similarEnergy=past.length>=7&&similar.length>=3?similar.reduce((sum,row)=>sum+row.energy,0)/similar.length:null;
  const suggestions:string[]=[];
  if(tired){
    suggestions.push("오늘은 선택 가능한 과제·집중 활동을 짧게 나누고, 여유 있는 일은 계획표에서 다음 날로 옮겨봐요.");
    if(highMental)suggestions.push("전날 부담이 높았어요. 좋아하는 책 한 문단, 편한 OTT 10~20분 또는 조용한 휴식 중 하나를 골라봐요.");
    if(highPhysical||current.unwell)suggestions.push("오늘 운동은 가벼운 스트레칭이나 휴식으로 바꿔봐요. 편안한 범위에서 선택해요.");
    else suggestions.push("몸이 괜찮다면 가벼운 산책 5~10분을 해보고 오늘 분량을 정해봐요.");
  }else if(current.energy>=4){
    suggestions.push("상쾌한 아침이에요. 오늘 계획 중 중요한 활동 하나부터 시작하고, 전날 기록을 비교해봐요.");
  }else{
    suggestions.push("집중 활동 사이에 5분 쉬는 시간을 넣고, 오늘 가능한 만큼 이어가봐요.");
  }
  if(current.sleepHours!==null&&tired)suggestions.push(`어젯밤 수면 ${Number(current.sleepHours.toFixed(1))}시간도 함께 기록했어요. 오늘은 가능한 취침 시간을 먼저 확보해봐요.`);
  return {current,patterns,suggestions,historyCount:past.length,goodCount:good.length,tired,similarEnergy,similarCount:similar.length};
}
