// One vocabulary for imports, legacy records, calculations and Korean presentation.
const definitions=[
  ["vitamin_a","비타민 A","μg RAE","Vitamin A|비타민A"],
  ["vitamin_c","비타민 C","mg","Vitamin C|비타민C"],
  ["vitamin_d","비타민 D","μg","Vitamin D|Vitamin D2|Vitamin D3|비타민D|비타민 D2|비타민 D3"],
  ["vitamin_e","비타민 E","mg","Vitamin E|비타민E"],
  ["vitamin_b1","비타민 B1","mg","Thiamin|Thiamine|Vitamin B1|티아민|티아민(B1)"],
  ["vitamin_b2","비타민 B2","mg","Riboflavin|Vitamin B2|리보플라빈|리보플라빈(B2)"],
  ["vitamin_b3","비타민 B3","mg NE","Niacin|Vitamin B3|나이아신|나이아신(B3)"],
  ["vitamin_b6","비타민 B6","mg","Vitamin B6|비타민B6"],
  ["folate","엽산","μg DFE","Folate|엽산(B9)|Vitamin B9"],
  ["folic_acid","엽산(폴릭산)","μg","Folic Acid|폴릭산"],
  ["vitamin_b12","비타민 B12","μg","Vitamin B12|비타민B12"],
  ["biotin","비오틴","μg","Biotin|비오틴(B7)|Vitamin B7"],
  ["pantothenic_acid","판토텐산","mg","Pantothenic Acid|판토텐산(B5)|Vitamin B5"],
  ["iodine","요오드","μg","Iodine"],["magnesium","마그네슘","mg","Magnesium"],
  ["zinc","아연","mg","Zinc"],["selenium","셀레늄","μg","Selenium|셀렌"],
  ["manganese","망간","mg","Manganese"],["chromium","크로뮴","μg","Chromium|크롬"],
  ["molybdenum","몰리브데넘","μg","Molybdenum|몰리브덴"],
  ["calcium","칼슘","mg","Calcium"],["iron","철분","mg","Iron|철"],
  ["potassium","칼륨","mg","Potassium"],["copper","구리","mg","Copper"],
  ["phosphorus","인","mg","Phosphorus"],["choline","콜린","mg","Choline"],
  ["fluoride","불소","mg","Fluoride|Fluorine"],
  ["vitamin_k","비타민 K","μg","Vitamin K|비타민K"],
  ["vitamin_k1","비타민 K1","μg","Vitamin K1|Phylloquinone"],
  ["vitamin_k2","비타민 K2","μg","Vitamin K2|Menaquinone"],
  ["protein","단백질","g","Protein"],["calories","열량","kcal","Calories|Energy|칼로리"],
  ["total_fat","총지방","g","Total Fat|총 지방|지방"],
  ["saturated_fat","포화지방","g","Saturated Fat|포화 지방"],
  ["trans_fat","트랜스지방","g","Trans Fat|트랜스 지방"],
  ["cholesterol","콜레스테롤","mg","Cholesterol"],["sodium","나트륨","mg","Sodium"],
  ["carbohydrates","탄수화물","g","Total Carbohydrate|Total Carbohydrates|Carbohydrate|Carbohydrates"],
  ["fiber","식이섬유","g","Dietary Fiber|Dietary Fibre|Fiber|식이 섬유"],
  ["total_sugars","총당류","g","Total Sugars|Sugars|당류|총 당류"],
  ["added_sugars","첨가당","g","Added Sugars|Includes Added Sugars|첨가 당"],
  ["lutein","루테인","mg","Lutein"],["zeaxanthin","지아잔틴","mg","Zeaxanthin|제아잔틴"],
  ["creatine","크레아틴","g","Creatine"],["epa","EPA","mg","EPA|Eicosapentaenoic Acid"],
  ["dha","DHA","mg","DHA|Docosahexaenoic Acid"],["omega3","오메가-3","mg","Omega 3|Omega-3|Total Omega-3 Fatty Acids"],
] as const;
const normalize=(text:string)=>text.normalize("NFKC").toLowerCase().replace(/[\s_\-(),®™]/g,"");
const aliases=new Map(definitions.flatMap(d=>[d[0],d[1],...d[3].split("|")].map(a=>[normalize(a),d] as const)));
export function nutrientDefinition(name:string){
  return aliases.get(normalize(name))??aliases.get(normalize(name.replace(/\s*\(as\s+.*$/i,"")));
}
export function nutrientDisplayName(name:string){return nutrientDefinition(name)?.[1]??`${name} · 성분명 확인 필요`;}
type NutrientFact={name:string;unit:string;amount?:number};
export function normalizedNutrient<T extends NutrientFact>(fact:T){
  const definition=nutrientDefinition(fact.name),id=definition?.[0]??`unknown:${encodeURIComponent(fact.name.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase())}`;
  let unit=fact.unit.normalize("NFKC").replaceAll("µ","μ"),amount=fact.amount;
  if(unit==="mcg")unit="μg";
  const scale:Record<string,number>={g:1000000,mg:1000,"μg":1},target=definition?.[2];
  // Form-specific units (RAE, DFE, NE and IU) are never silently treated as mass.
  if(target&&scale[target]&&scale[unit]){if(amount!==undefined)amount=amount*scale[unit]/scale[target];unit=target;}
  return {...fact,name:definition?.[1]??fact.name,nutrientId:id,unit,amount,recognized:!!definition};
}
export function canonicalNutrientKey(fact:NutrientFact){const f=normalizedNutrient(fact);return `${f.nutrientId}|${f.unit}`;}
export function nutrientIdentity(name:string){return nutrientDefinition(name)?.[0];}
export function nutrientOrder(name:string){const d=nutrientDefinition(name);return d?definitions.indexOf(d):definitions.length;}
