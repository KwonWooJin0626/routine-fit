import { supplementProductSchema,type SupplementProduct } from "./supplement-journal";
import { supplementFactUnits,type SupplementLabel } from "./supplement-label";

export function updateManualSupplementLabel(product:SupplementProduct,values:Record<string,string>,unit:SupplementLabel["servingUnit"],dose:string){
  if(product.label&&!product.label.partial&&product.label.source!=="manual")throw Error("확인된 성분표는 제품 수정에서 변경해 주세요.");
  const facts=[...(product.label?.facts??[])];
  for(const [key,value] of Object.entries(values)){
    const [name,factUnit,...extra]=key.split("|");
    if(!name||extra.length||!supplementFactUnits.includes(factUnit as typeof supplementFactUnits[number]))throw Error("성분과 단위를 확인해 주세요.");
    const index=facts.findIndex(f=>f.name===name&&f.unit===factUnit);
    if(index>=0&&!facts[index].manual)throw Error("가져온 성분 함량은 직접 입력으로 덮어쓸 수 없어요.");
    const amount=value.trim()===""?null:Number(value);
    if(amount!==null&&(!/^\d+(?:\.\d+)?$/.test(value.trim())||!Number.isFinite(amount)||amount<0))throw Error("함량은 0 이상의 숫자로 입력해 주세요.");
    if(index>=0)facts.splice(index,1);
    if(amount!==null)facts.push({name,unit:factUnit as typeof supplementFactUnits[number],amount,dailyValuePercent:null,manual:true});
  }
  const label=facts.length?{...product.label,source:product.label?.source??"manual",partial:true,
    servingSize:product.label?.servingSize??1,servingUnit:product.label?.servingUnit??unit,facts}:undefined;
  return supplementProductSchema.parse({...product,dose,label});
}
