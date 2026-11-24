import { canonicalNutrientKey,normalizedNutrient,nutrientDefinition } from "./supplement-nutrients";
import { supplementProductSchema,type SupplementProduct } from "./supplement-journal";
import { supplementFactUnits,type SupplementLabel } from "./supplement-label";

export function updateManualSupplementLabel(product:SupplementProduct,values:Record<string,string>,unit:SupplementLabel["servingUnit"],dose:string){
  if(product.label&&!product.label.partial&&product.label.source!=="manual")throw Error("확인된 성분표는 제품 수정에서 변경해 주세요.");
  const facts=[...(product.label?.facts??[])];
  for(const [key,value] of Object.entries(values)){
    const [inputName,factUnit,...extra]=key.split("|");const name=nutrientDefinition(inputName)?.[1]??(inputName.startsWith("unknown:")?decodeURIComponent(inputName.slice(8)):inputName);
    if(!name||extra.length||!supplementFactUnits.includes(factUnit as typeof supplementFactUnits[number]))throw Error("성분과 단위를 확인해 주세요.");
    const matches=facts.filter(f=>canonicalNutrientKey(f)===canonicalNutrientKey({name,unit:factUnit}));
    if(matches.length>1)throw Error("중복된 성분은 원본 성분표를 다시 선택해 확인해 주세요.");
    const index=facts.findIndex(f=>canonicalNutrientKey(f)===canonicalNutrientKey({name,unit:factUnit}));
    if(index>=0&&!facts[index].manual)throw Error("가져온 성분 함량은 직접 입력으로 덮어쓸 수 없어요.");
    const amount=value.trim()===""?null:Number(value);
    if(amount!==null&&(!/^\d+(?:\.\d+)?$/.test(value.trim())||!Number.isFinite(amount)||amount<0))throw Error("함량은 0 이상의 숫자로 입력해 주세요.");
    if(index>=0)facts.splice(index,1);
    if(amount!==null){const normalized=normalizedNutrient({name,unit:factUnit,amount});facts.push({name:normalized.name,nutrientId:nutrientDefinition(name)?.[0],rawName:name,unit:normalized.unit as typeof supplementFactUnits[number],amount:normalized.amount!,dailyValuePercent:null,manual:true});}
  }
  const label=facts.length?{...product.label,source:product.label?.source??"manual",partial:true,
    servingSize:product.label?.servingSize??1,servingUnit:product.label?.servingUnit??unit,facts}:undefined;
  return supplementProductSchema.parse({...product,dose,label});
}
