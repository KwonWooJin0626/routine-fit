import { canonicalNutrientKey,normalizedNutrient,nutrientOrder } from "./supplement-nutrients";
import { localDate,type AppState } from "./model";
import { addDate } from "./planner";
import { supplementOccurrences,type SupplementJournal } from "./supplement-journal";
import type { SupplementLabel } from "./supplement-label";

type Fact=SupplementLabel["facts"][number];
type Column=Pick<Fact,"name"|"unit">;
type IntakeRow={id:string;name:string;amounts:Record<string,number>;missing:boolean;doseUnknown:boolean;occurrences:number;unconfirmed:boolean;knownKeys:string[];uncertainKeys:string[]};
export const nutrientKey=canonicalNutrientKey;
export function intakeColumnIncomplete(rows:IntakeRow[],column:Column){
  const key=nutrientKey(column);
  return rows.some(row=>row.uncertainKeys.includes(key)||(row.knownKeys.includes(key)?row.doseUnknown:row.unconfirmed));
}

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
    const row=rows.get(id)??{id,name,amounts:{},missing:false,doseUnknown:false,occurrences:0,unconfirmed:false,knownKeys:[],uncertainKeys:[]};
    rows.set(id,row);row.occurrences++;
    row.unconfirmed ||= !label||!!label.partial;
    const factor=label?servingCount(dose,label):null;
    if(!label||label.partial||factor===null)row.missing=true;
    if(factor===null)row.doseUnknown=true;
    const grouped=new Map<string,Fact[]>();
    for(const fact of label?.facts??[]){const key=nutrientKey(fact);grouped.set(key,[...(grouped.get(key)??[]),fact]);}
    for(const [key,group] of grouped){
      const fact=normalizedNutrient(group[0]);
      columns.set(key,{name:fact.name,unit:fact.unit as Fact["unit"]});
      // Two aliases inside one label may describe the same row twice. Never double-count.
      if(group.length>1){row.missing=true;row.unconfirmed=true;if(!row.uncertainKeys.includes(key))row.uncertainKeys.push(key);continue;}
      if(!row.knownKeys.includes(key))row.knownKeys.push(key);
      if(factor===null)continue;
      const amount=fact.amount!*factor;
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
    for(const legacy of defaultColumns){
      const [name,unit]=legacy.split("|"),column=normalizedNutrient({name,unit});const key=nutrientKey(column);if(!columns.has(key))columns.set(key,{name:column.name,unit:column.unit as Fact["unit"]});
    }
  }
  return {columns:[...columns.values()].sort((a,b)=>nutrientOrder(a.name)-nutrientOrder(b.name)||a.unit.localeCompare(b.unit)||a.name.localeCompare(b.name)),rows:[...rows.values()],totals,
    missingCount:[...rows.values()].filter(row=>row.missing).length};
}

// Fallback column vocabulary only. Numeric DV data is not used for comparison.
const defaultColumns=[
  "비타민 A|μg RAE","비타민 C|mg","비타민 D|μg","비타민 E|mg",
  "비타민 B1|mg","비타민 B2|mg","비타민 B3|mg NE","비타민 B6|mg",
  "엽산|μg DFE","비타민 B12|μg","비오틴|μg","판토텐산|mg",
  "요오드|μg","마그네슘|mg","아연|mg","셀레늄|μg","망간|mg","크로뮴|μg","몰리브데넘|μg",
  "칼슘|mg","철분|mg","칼륨|mg","구리|mg","인|mg","콜린|mg","비타민 K|μg","단백질|g",
];
export { upperIntakeStatus as intakeStatus } from "./supplement-upper-limits";
