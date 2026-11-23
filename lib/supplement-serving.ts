import type { SupplementLabel } from "./supplement-label";
import { labelServingUnit } from "./supplement-label-photo";

// Deliberately accept only a single, explicit fixed daily instruction.
export function parseDailyLabelUse(text:string,unit:SupplementLabel["servingUnit"]){
  const matches=[...text.matchAll(/\btake\s+(\d+(?:\.\d+)?)\s+(soft\s?gels?|capsules?|tablets?|caplets?|scoops?|ml|g)\s+(?:once\s+)?(?:daily|per day)\b/gi)];
  if(matches.length!==1||/\b(?:or|as needed|up to|twice|three times|children|child)\b/i.test(text))return undefined;
  const [,amount,rawUnit]=matches[0],value=Number(amount);
  return labelServingUnit(rawUnit)===unit&&value>0&&value<=1000000?value:undefined;
}
export function labelDefaultDose(label:SupplementLabel|undefined,slots=1){
  if(!label)return "";
  if(label.dailyUnits!==undefined){
    const dose=label.dailyUnits/slots;
    if(!Number.isInteger(dose)&&!["mL","g"].includes(label.servingUnit))return "";
    return String(dose);
  }
  return String(label.servingSize);
}
export function plannedSupplementDose(product:{dose:string;label?:SupplementLabel;slots:{id:string}[]}){
  return product.dose||labelDefaultDose(product.label,product.slots.length);
}
