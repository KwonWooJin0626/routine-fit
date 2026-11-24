import { normalizedNutrient } from "./supplement-nutrients";

// 보건복지부·한국영양학회, 2025 한국인 영양소 섭취기준, 요약표 xii–xviii.
// User-provided 2025.12.29 PDF SHA256:
// 605ff8431ea7b6c465165bb5335aba580dcd4d56ba13a69583e62d163a7cc0c2
export const kdriSource="https://www.kns.or.kr/fileroom/fileroom_view.asp?BoardID=Kdr&idx=167";
export const upperAgeGroups=["19-29","30-49","50-64","65-74","75+","15-18"] as const;
export type UpperTarget={age:"adult"|typeof upperAgeGroups[number];sex:"all"|"male"|"female";stage:"general"|"pregnant"|"lactating"};
export const defaultUpperTarget:UpperTarget={age:"adult",sex:"all",stage:"general"};
type Column={name:string;unit:string};
const fixed:Record<string,[number,string]>={vitamin_a:[3000,"μg RAE"],vitamin_c:[2000,"mg"],vitamin_d:[100,"μg"],
  vitamin_e:[540,"mg α-TE"],vitamin_b6:[50,"mg"],folic_acid:[1000,"μg"],folate:[1000,"μg"],
  magnesium:[350,"mg"],iron:[45,"mg"],zinc:[35,"mg"],copper:[10,"mg"],fluoride:[10,"mg"],
  manganese:[11,"mg"],iodine:[2400,"μg"],selenium:[400,"μg"]};
const teen:Record<string,number>={vitamin_a:2800,vitamin_c:1600,vitamin_e:500,vitamin_b6:45,folate:900,folic_acid:900,magnesium:330,zinc:33,copper:9.5,manganese:10,iodine:2200,selenium:300};
function limitFor(id:string,age:typeof upperAgeGroups[number],sex:"male"|"female",stage:UpperTarget["stage"]):[number,string]|undefined{
  // Maternal rows in this summary are reference values for adult women.
  if(stage!=="general"&&age==="15-18")return;
  if(id==="iodine"&&stage!=="general")return;
  if(id==="choline")return [sex==="male"?age==="15-18"?2500:3000:age==="15-18"?2000:2500,"mg"];
  if(id==="calcium")return [sex==="male"?(age==="15-18"||age==="19-29"?3000:2500):(age==="15-18"||age==="19-29"?2500:2000),"mg"];
  if(id==="phosphorus")return [stage==="pregnant"?3000:stage==="lactating"?3500:age==="75+"?3000:3500,"mg"];
  if(id==="molybdenum")return [sex==="male"?(age==="19-29"?650:age==="75+"?550:600):(age==="75+"&&stage==="general"?450:500),"μg"];
  const entry=fixed[id];return entry?[age==="15-18"?teen[id]??entry[0]:entry[0],entry[1]]:undefined;
}

export function upperLimit(column:Column,target:UpperTarget=defaultUpperTarget){
  const id=normalizedNutrient(column).nutrientId;
  const scope=id==="magnesium"?"식품 외 급원":id==="vitamin_b3"?"형태별 적용 범위 확인 필요":"식사 포함 전체 섭취";
  if(target.stage!=="general"&&target.age==="15-18")return {scope,reference:undefined,unit:column.unit,text:"자동 비교 대상 외",pending:"15~18세 임신·수유 개별 확인 필요"};
  if(id==="vitamin_b3")return {scope,reference:undefined,unit:"mg",text:target.age==="15-18"?"니코틴산 30 / 니코틴아미드 650 mg":"니코틴산 35 / 니코틴아미드 850 mg",pending:"니아신 형태·실제 함량 확인 필요"};
  const ages=target.age==="adult"?upperAgeGroups.filter(a=>a!=="15-18"):[target.age];
  const sexes=target.stage!=="general"?["female" as const]:target.sex==="all"?["male" as const,"female" as const]:[target.sex];
  const limits=ages.flatMap(age=>sexes.map(sex=>limitFor(id,age,sex,target.stage)));
  if(limits.some(value=>!value)||!limits.length)return {scope,reference:undefined,unit:column.unit,text:"상한 미설정",pending:undefined};
  const values=limits.map(value=>value![0]),unit=limits[0]![1],min=Math.min(...values),max=Math.max(...values);
  return {scope,reference:min===max?min:undefined,unit,text:`${min===max?min.toLocaleString("ko-KR"):min.toLocaleString("ko-KR")+"~"+max.toLocaleString("ko-KR")} ${unit}`,
    pending:min===max?undefined:"연령·성별 선택 필요"};
}

export function upperIntakeStatus(column:Column,total:number|undefined,incomplete:boolean,target:UpperTarget=defaultUpperTarget){
  const normalized=normalizedNutrient({...column,amount:total}),limit=upperLimit(column,target),id=normalized.nutrientId;
  const base={reference:limit.reference,referenceText:limit.text,referenceUnit:limit.unit,scope:limit.scope,incomplete,percent:undefined as number|undefined};
  const status=(level:string,label:string)=>({...base,level,label});
  if(total===undefined)return status("unknown","확인된 양 없음");
  if(limit.pending)return status("unknown",limit.pending);
  if(!limit.reference)return status("unknown","상한 미설정 · 판정 보류");
  // The display totals do not establish retinol fraction, α-TE, or actual folic acid.
  // Do not turn total RAE, US vitamin E mg or DFE into an eligible UL numerator.
  if(id==="vitamin_a")return status("unknown","레티놀 함량 확인 필요");
  if(id==="folate")return status("unknown","DFE와 상한 단위 다름 · 판정 보류");
  if(normalized.unit!==limit.unit)return status("unknown","성분 형태·단위 확인 필요");
  base.percent=normalized.amount!/limit.reference*100;
  if(base.percent>100)return status("high","⚠ 상한 초과");
  if(base.percent===100)return status("at","상한 도달");
  if(base.percent>=90)return status("near","상한 근접");
  return status("below","상한 미만 · 영양제만 비교");
}

// U.S. FNB ULs: NCBI DRI summary tables and current NIH ODS fact sheets.
// Teen age bands differ (US 14–18); until independently covered, do not infer.
export const usUpperSource="https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t7/?report=objectonly";
export function usUpperStatus(column:Column,total:number|undefined,target:UpperTarget=defaultUpperTarget){
  const f=normalizedNutrient({...column,amount:total}),id=f.nutrientId;
  const limits:Record<string,[number,string]>={vitamin_c:[2000,"mg"],vitamin_d:[100,"μg"],vitamin_b6:[100,"mg"],
    folic_acid:[1000,"μg"],magnesium:[350,"mg"],iron:[45,"mg"],zinc:[40,"mg"],copper:[10,"mg"],fluoride:[10,"mg"],
    manganese:[11,"mg"],iodine:[1100,"μg"],selenium:[400,"μg"],molybdenum:[2000,"μg"],choline:[3500,"mg"]};
  let entry=limits[id];
  if(id==="calcium"&&["19-29","30-49"].includes(target.age))entry=[2500,"mg"];
  if(id==="calcium"&&["65-74","75+"].includes(target.age))entry=[2000,"mg"];
  if(id==="calcium"&&target.stage!=="general"&&target.age!=="15-18")entry=[2500,"mg"];
  const reference=entry?.[0],referenceText=entry?`${reference!.toLocaleString("ko-KR")} ${entry[1]}`:"형태·대상별 기준 확인 필요";
  if(target.age==="15-18")return {label:"미국 연령별 기준 확인 필요",referenceText:"15~18세 자동 비교 보류"};
  if(!entry)return {label:"미국 판정 보류",referenceText};
  if(total===undefined)return {label:"미국 확인된 양 없음",referenceText};
  if(f.unit!==entry[1])return {label:"미국 단위 확인 필요",referenceText};
  return {label:`미국 상한 ${f.amount!>reference!?"초과":f.amount===reference?"도달":"미만"}`,referenceText};
}
export function bilateralUpperStatus(column:Column,total:number|undefined,incomplete:boolean,target:UpperTarget=defaultUpperTarget){
  const korea=upperIntakeStatus(column,total,incomplete,target),us=usUpperStatus(column,total,target);
  const koreanLabel=korea.percent===undefined?`한국 ${korea.label}`:`한국 상한 ${korea.percent>100?"초과":korea.percent===100?"도달":"미만"}`;
  return {...korea,label:`${koreanLabel} · ${us.label}`,usReferenceText:us.referenceText};
}
