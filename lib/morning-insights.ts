import { localDate,type AppState,type Checkin } from "./model";
import { addDate } from "./planner";
import { actualTimeSpans,plannedLoad,partitionTime } from "./lifestyle-charts";
import { humanDocument } from "./activity-journal";
import { calculatePet } from "./pet-engine";
import type { PetDocument } from "./pet-model";
import type { MorningRecord } from "./morning-model";
import { executionSegments } from "./pet-execution";

export function captureMorning(state:AppState,checkin:Checkin,pet:PetDocument|null,now=new Date()):MorningRecord|null{
  if(!checkin.morning||!checkin.energyKnown||!checkin.reported)return null;
  const date=localDate(now),previous=addDate(date,-1),midnight=Date.parse(date+"T00:00:00+09:00");
  const doc=humanDocument(state,pet);
  const sleeps=doc.records.filter(r=>r.type==="sleep"&&!r.cancelled&&Date.parse(r.end)<=now.getTime()&&localDate(new Date(r.end))===date)
    .map(record=>({record,minutes:executionSegments(record).reduce((n,s)=>n+Math.max(0,s.end-Math.max(now.getTime()-24*3600000,s.start))/60000,0)}))
    .filter(r=>r.minutes>0).sort((a,b)=>b.minutes-a.minutes);
  const sleep=sleeps[0];
  const lastEnd=doc.records.filter(r=>!r.cancelled&&r.type!=="sleep"&&Date.parse(r.end)<=midnight&&Date.parse(r.end)>=midnight-86400000)
    .reduce((n,r)=>Math.max(n,Date.parse(r.end)),0);
  const snapshot=sleep?Date.parse(sleep.record.start):lastEnd||midnight;
  const windowStart=snapshot-86400000;
  // A rolling pre-sleep day handles overnight work. Clip completed actual segments only.
  const spans=[-1,0,1].flatMap(offset=>{
    const d=addDate(localDate(new Date(windowStart)),offset),start=Date.parse(d+"T00:00:00+09:00");
    return actualTimeSpans(state,d,pet).filter(s=>s.category!=="sleep").map(s=>({...s,
      from:Math.max(0,(start+s.from*60000-windowStart)/60000),until:Math.min(1440,(start+s.until*60000-windowStart)/60000)})).filter(s=>s.until>s.from);
  });
  const load=plannedLoad(spans),minutes=(categories:string[])=>partitionTime(spans.filter(s=>categories.includes(s.category)),previous).occupied;
  const highMentalMinutes=plannedLoad(spans.filter(s=>(s.mental??0)>=4)).minutes;
  const highPhysicalMinutes=plannedLoad(spans.filter(s=>(s.physical??0)>=4)).minutes;
  const points=[...new Set([0,1440,...spans.flatMap(s=>[s.from,s.until]),...Array.from({length:25},(_,i)=>i*60-((windowStart/60000+540)%60)).filter(n=>n>=0&&n<=1440)])].sort((a,b)=>a-b);
  let lateMinutes=0;
  for(let i=0;i<points.length-1;i++){
    const from=points[i],until=points[i+1],hour=new Date(windowStart+(from+until)/2*60000+9*3600000).getUTCHours();
    if((hour>=22||hour<6)&&spans.some(s=>s.from<until&&s.until>from))lateMinutes+=until-from;
  }
  const reported=checkin.sleepKnown===true;
  const petState=pet&&Date.parse(pet.seed.at)<=snapshot?calculatePet(pet,new Date(snapshot)).stats:null;
  return {date,recordedAt:now.toISOString(),energy:checkin.energy,unwell:checkin.unwell,
    sleepHours:reported?checkin.sleep:sleep?Math.min(24,sleep.minutes/60):null,
    sleepSource:reported?"reported":sleep?"recorded":"unknown",
    previousMental:load.mental,previousPhysical:load.physical,
    previousMentalMinutes:load.mentalMinutes,previousPhysicalMinutes:load.physicalMinutes,
    previousActivityMinutes:Math.min(1440,minutes(spans.map(s=>s.category))),
    previousExercise:Math.min(1440,minutes(["exercise"])),
    previousFocus:Math.min(1440,minutes(["study","task","work","growth"])),
    previousRest:Math.min(1440,minutes(["rest","leisure"])),
    snapshotAt:new Date(snapshot).toISOString(),snapshotBasis:sleep?"sleep":lastEnd?"activity":"midnight",windowStart:new Date(windowStart).toISOString(),
    highMentalMinutes,highPhysicalMinutes,lateMinutes:Math.min(1440,lateMinutes),
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
  const highMental=(current.previousMental??0)>=4||(current.highMentalMinutes??0)>=90||(current.petStress??0)>=80;
  const highPhysical=(current.previousPhysical??0)>=4||(current.highPhysicalMinutes??0)>=90||(current.petStamina!==null&&current.petStamina<=30);
  const comparable=past.map(row=>({row,score:morningSimilarity(row,current)})).filter((item):item is {row:MorningRecord;score:number}=>item.score!==null);
  const similar=comparable.filter(item=>item.score>=.8).map(item=>item.row);
  const ready=comparable.length>=14&&similar.length>=5;
  const similarEnergy=ready?similar.reduce((sum,row)=>sum+row.energy,0)/similar.length:null;
  const distribution=ready?{good:similar.filter(r=>r.energy>=4&&!r.unwell).length,
    normal:similar.filter(r=>r.energy===3&&!r.unwell).length,tired:similar.filter(r=>r.energy<=2||r.unwell).length}:null;
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
  return {current,patterns,suggestions,historyCount:past.length,goodCount:good.length,tired,distribution,similarEnergy,similarCount:similar.length};
}

/** Similarity is descriptive: missing dimensions never become zero-valued observations. */
export function morningSimilarity(a:MorningRecord,b:MorningRecord):number|null{
  if(a.sleepHours===null||b.sleepHours===null)return null;
  const dims:{weight:number;distance:number}[]=[{weight:30,distance:Math.min(1,Math.abs(a.sleepHours-b.sleepHours)/4)}];
  let burden=false;
  for(const [key,weight] of [["previousMental",25],["previousPhysical",20]] as const){
    if(a[key]!==null&&b[key]!==null){dims.push({weight,distance:Math.abs(a[key]!-b[key]!)/4});burden=true;}
  }
  if(!burden)return null;
  // Rest is comparable only when both days have actual activity coverage.
  if(a.previousActivityMinutes>0&&b.previousActivityMinutes>0)dims.push({weight:15,distance:Math.min(1,Math.abs(a.previousRest-b.previousRest)/120)});
  if(a.petStress!==null&&b.petStress!==null&&a.petStamina!==null&&b.petStamina!==null)
    dims.push({weight:10,distance:(Math.abs(a.petStress-b.petStress)/100+Math.min(1,Math.abs(a.petStamina-b.petStamina)/150))/2});
  return 1-dims.reduce((n,d)=>n+d.weight*d.distance,0)/dims.reduce((n,d)=>n+d.weight,0);
}
