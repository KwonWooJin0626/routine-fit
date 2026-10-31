import { localDate } from "./model";
import { initialPetStats,type EffectType,type PetDocument,type PetEffect,type PetExecution,type PetStats,type PetView } from "./pet-model";

const MINUTE=60000,DAY=86400000;
const rates:Record<EffectType,[number,number,number,number]>={study:[-3,3,10,0],work:[-4,3,0,0],exercise:[-8,2,0,5],growth:[-2,2,8,0],social:[2,-3,0,0],sleep:[8,-2,0,0],rest:[6,-4,0,0],leisure:[3,-3,0,0],none:[0,0,0,0],meal:[0,0,0,0]};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const copy=(s:PetStats):PetStats=>({...s});
export function petBaseState(fullness:number,stress:number):"idle"|"tired"{return fullness<=30||stress>=80?"tired":"idle";}
function addGrowth(s:PetStats,fitness:number,learning:number){
  s.fitnessTotalXP+=fitness;s.learningTotalXP+=learning;s.fitnessXP+=fitness;s.learningXP+=learning;
  const grows=Math.floor((s.fitnessXP+1e-9)/50);s.fitnessXP=Math.max(0,s.fitnessXP-grows*50);s.maxStamina=Math.min(150,s.maxStamina+grows*5);
  while(s.learningXP+1e-9>=100+20*(s.learningLevel-1)){s.learningXP=Math.max(0,s.learningXP-(100+20*(s.learningLevel-1)));s.learningLevel++;}
}
export function calculatePet(doc:PetDocument,now=new Date()):PetView&{lastEvidenceAt:string}{
  const at=Math.max(new Date(doc.seed.at).getTime(),now.getTime()),begin=new Date(doc.seed.at).getTime(),s=copy(doc.seed.stats);
  let lastEvidence=new Date(doc.seed.lastEvidenceAt).getTime();
  const records=doc.records.filter(r=>!r.cancelled&&new Date(r.end).getTime()>=begin&&new Date(r.start).getTime()<at+1).sort((a,b)=>a.end.localeCompare(b.end)||a.id.localeCompare(b.id));
  const points=new Set<number>([begin,at]);
  for(const r of records){points.add(clamp(new Date(r.start).getTime(),begin,at));points.add(clamp(new Date(r.end).getTime(),begin,at));}
  let midnight=new Date(`${localDate(new Date(begin))}T00:00:00+09:00`).getTime()+DAY;
  while(midnight<at){points.add(midnight);midnight+=DAY;}
  const bounds=[...points].sort((a,b)=>a-b),fitnessByDate:Record<string,number>={},sleepByDate:Record<string,number>={},effects=new Map<string,PetEffect>();
  function effect(r:PetExecution){let e=effects.get(r.id);if(!e){e={id:r.id,title:r.title,type:r.type,end:r.end,stamina:0,stress:0,fitnessXP:0,learningXP:0,requestedFitnessXP:0};effects.set(r.id,e);}return e;}
  const appliedMeals=new Set<string>(),appliedFeelings=new Set<string>();
  function instantaneous(time:number){for(const r of records){if(new Date(r.end).getTime()!==time)continue;
    if(r.type==="meal"&&!appliedMeals.has(r.id)){const e=effect(r),old=s.stress;s.fullness=r.fullness??60;s.stress=clamp(s.stress-4,0,100);e.stress+=s.stress-old;e.fullness=s.fullness;lastEvidence=Math.max(lastEvidence,time);appliedMeals.add(r.id);}
    if(!appliedFeelings.has(r.id)&&r.feeling!=="same"){const old=s.stress;s.stress=clamp(s.stress+(r.feeling==="fresh"?-3:3),0,100);effect(r).stress+=s.stress-old;appliedFeelings.add(r.id);}
  }}
  instantaneous(begin);
  for(let i=1;i<bounds.length;i++){
    const from=bounds[i-1],until=bounds[i],minutes=(until-from)/MINUTE,date=localDate(new Date(from));
    const active=records.find(r=>r.type!=="meal"&&new Date(r.start).getTime()<=from&&new Date(r.end).getTime()>=until);
    if(active){
      const e=effect(active),rate=rates[active.type],factor={light:.75,moderate:1,high:1.25}[active.intensity];
      let effective=minutes;
      if(active.type==="sleep"){effective=Math.min(minutes,Math.max(0,540-(sleepByDate[date]??0)));sleepByDate[date]=(sleepByDate[date]??0)+minutes;}
      const staminaBefore=s.stamina,stressBefore=s.stress;
      s.stamina=clamp(s.stamina+rate[0]*effective/30*(rate[0]<0?factor:1),0,s.maxStamina);
      s.stress=clamp(s.stress+rate[1]*effective/30*(rate[1]>0?factor:1),0,100);
      e.stamina+=s.stamina-staminaBefore;e.stress+=s.stress-stressBefore;
      const requested=rate[3]*minutes/30,fitness=Math.min(requested,Math.max(0,30-(fitnessByDate[date]??0))),learning=rate[2]*effective/30;
      fitnessByDate[date]=(fitnessByDate[date]??0)+fitness;e.requestedFitnessXP+=requested;e.fitnessXP+=fitness;e.learningXP+=learning;
      addGrowth(s,fitness,learning);s.fullness=clamp(s.fullness-minutes*8/30,0,100);lastEvidence=until;
    }else{
      const autoMinutes=Math.max(0,Math.min(until,lastEvidence+DAY)-from)/MINUTE;
      s.stamina=clamp(s.stamina+autoMinutes*2/60,0,s.maxStamina);s.stress=clamp(s.stress-autoMinutes/60,0,100);s.fullness=clamp(s.fullness-autoMinutes*8/30,0,100);
    }
    instantaneous(until);
  }
  const reasons=[s.fullness<=30?"포만감 기록이 낮아요":"",s.stress>=80?"기록 기준 스트레스가 높아요":""].filter(Boolean);
  return {profile:{name:doc.name,visible:doc.visible,reducedMotion:doc.reducedMotion,adoptedAt:doc.adoptedAt,archivedCount:doc.archivedCount},stats:s,
    baseState:petBaseState(s.fullness,s.stress),reasons,evaluatedAt:new Date(at).toISOString(),changes:[...effects.values()].sort((a,b)=>b.end.localeCompare(a.end)),todayFitnessXP:fitnessByDate[localDate(now)]??0,pausedByGap:at-lastEvidence>=DAY,lastEvidenceAt:new Date(lastEvidence).toISOString()};
}
export function newPetDocument(name:string,id:string,now:Date):PetDocument{const at=now.toISOString();return {version:1,ruleVersion:"2026-10-pet-v1",lifecycleId:id,adoptedAt:at,name,visible:true,reducedMotion:false,records:[],seed:{at,lastEvidenceAt:at,stats:initialPetStats()},archivedCount:0,receipts:[]};}
export function compactPet(doc:PetDocument,now:Date):PetDocument{
  const cutoff=new Date(`${localDate(new Date(now.getTime()-90*DAY))}T00:00:00+09:00`);
  if(cutoff.getTime()<=new Date(doc.seed.at).getTime())return doc;
  const seed=calculatePet(doc,cutoff),keep=doc.records.filter(r=>new Date(r.end)>cutoff),removed=doc.records.length-keep.length;
  return {...doc,records:keep,seed:{at:cutoff.toISOString(),lastEvidenceAt:seed.lastEvidenceAt,stats:seed.stats},archivedCount:doc.archivedCount+removed};
}
