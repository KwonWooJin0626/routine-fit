import { localDate,type AppState } from "./model";
import { addDate } from "./planner";
import { supplementOccurrences,type SupplementJournal } from "./supplement-journal";
import type { SupplementLabel } from "./supplement-label";

type Fact=SupplementLabel["facts"][number];
type Column=Pick<Fact,"name"|"unit">;
type IntakeRow={id:string;name:string;amounts:Record<string,number>;missing:boolean;doseUnknown:boolean;occurrences:number;unconfirmed:boolean;knownKeys:string[]};
export const nutrientKey=(fact:Column)=>`${fact.name}|${fact.unit}`;

export function servingCount(dose:string,label:SupplementLabel){
  const match=dose.trim().match(/^(\d+(?:\.\d+)?)(?:\s*(정|캡슐|스쿱|mL|g|포|방울|소프트젤))?$/i);
  if(!match||(match[2]&&match[2].toLowerCase()!==label.servingUnit.toLowerCase()))return null;
  const units=Number(match[1]);
  return units>0&&units<=1000000?units/label.servingSize:null;
}

export function supplementIntake(journal:SupplementJournal,app:AppState,date:string,mode:"plan"|"actual"){
  const columns=new Map<string,Column>(),rows=new Map<string,IntakeRow>();
  const totals:Record<string,number>={};
  function add(id:string,name:string,dose:string,label?:SupplementLabel){
    const row=rows.get(id)??{id,name,amounts:{},missing:false,doseUnknown:false,occurrences:0,unconfirmed:false,knownKeys:[]};
    rows.set(id,row);row.occurrences++;
    row.unconfirmed ||= !label||!!label.partial;
    const factor=label?servingCount(dose,label):null;
    if(!label||label.partial||factor===null)row.missing=true;
    if(factor===null)row.doseUnknown=true;
    for(const fact of label?.facts??[]){
      const key=nutrientKey(fact);
      if(!row.knownKeys.includes(key))row.knownKeys.push(key);
      columns.set(key,{name:fact.name,unit:fact.unit});
      if(factor===null)continue;
      const amount=fact.amount*factor;
      row.amounts[key]=(row.amounts[key]??0)+amount;
      totals[key]=(totals[key]??0)+amount;
    }
  }
  if(mode==="plan"){
    for(const offset of [-1,0,1]){
      for(const item of supplementOccurrences({products:journal.products,records:[]},addDate(date,offset),app)){
        if(localDate(new Date(item.plannedAt))===date){
          add(item.product.id,item.product.name,item.product.dose,item.product.label);
        }
      }
    }
  }else{
    for(const record of journal.records){
      if(record.status!=="taken"||(record.actualAt?localDate(new Date(record.actualAt)):record.date)!==date)continue;
      add(record.productId,record.snapshot.name,record.dose,record.snapshot.label);
    }
  }
  if([...rows.values()].some(row=>row.unconfirmed)){
    for(const key of Object.keys(dailyValues))if(!columns.has(key)){
      const [name,unit]=key.split("|");columns.set(key,{name,unit:unit as Fact["unit"]});
    }
  }
  return {columns:[...columns.values()],rows:[...rows.values()],totals,
    missingCount:[...rows.values()].filter(row=>row.missing).length};
}

// U.S. FDA label Daily Values. Keep different forms and units separate.
const dailyValues:Record<string,number>={
  "비타민 A|μg RAE":900,"비타민 C|mg":90,"비타민 D3|μg":20,"비타민 E|mg":15,
  "티아민(B1)|mg":1.2,"리보플라빈(B2)|mg":1.3,"나이아신(B3)|mg NE":16,"비타민 B6|mg":1.7,
  "엽산(B9)|μg DFE":400,"비타민 B12|μg":2.4,"비오틴(B7)|μg":30,"판토텐산(B5)|mg":5,
  "요오드|μg":150,"마그네슘|mg":420,"아연|mg":11,"셀레늄|μg":55,"망간|mg":2.3,"크로뮴|μg":35,"몰리브데넘|μg":45,
  "칼슘|mg":1300,"철분|mg":18,"칼륨|mg":4700,"구리|mg":0.9,"인|mg":1250,"콜린|mg":550,"비타민 K|μg":120,"단백질|g":50,
};
export function intakeStatus(column:Column,total:number|undefined,incomplete:boolean){
  const aliases:Record<string,string>={"비타민 d":"비타민 D3",calcium:"칼슘",iron:"철분",potassium:"칼륨",copper:"구리",phosphorus:"인",choline:"콜린",protein:"단백질"};
  const key=nutrientKey({name:aliases[column.name.toLowerCase()]??column.name,unit:column.unit}),reference=dailyValues[key],percent=reference&&total!==undefined?total/reference*100:undefined;
  // NIH vitamin D upper limit for ages 9 and older. Known amount alone can exceed it.
  if(key==="비타민 D3|μg"&&total!==undefined&&total>100)return {level:"high",label:"⚠ 상한 기준 초과",reference,percent};
  if(incomplete||total===undefined)return {level:"unknown",label:"일부 미확인",reference,percent};
  if(!reference)return {level:"unknown",label:"비교 기준 없음",reference,percent};
  if(percent!<50)return {level:"verylow",label:"기준 대비 50% 미만",reference,percent};
  if(percent!<70)return {level:"low",label:"기준 대비 50~70%",reference,percent};
  if(percent!<90)return {level:"within",label:"기준 대비 70~90%",reference,percent};
  if(percent!<95)return {level:"near",label:"기준에 근접",reference,percent};
  return {level:"above",label:"기준 대비 95% 이상",reference,percent};
}
