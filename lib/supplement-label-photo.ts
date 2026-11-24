import { nutrientIdentity } from "./supplement-nutrients";
import { iherbProductId,supplementLabelSchema,type SupplementLabel } from "./supplement-label";

const servingUnits:Record<string,SupplementLabel["servingUnit"]>={
  tablet:"정",caplet:"정",capsule:"캡슐",scoop:"스쿱",ml:"mL",g:"g",packet:"포",sachet:"포",drop:"방울",softgel:"소프트젤",
  정:"정",캡슐:"캡슐",스쿱:"스쿱",포:"포",방울:"방울",소프트젤:"소프트젤",
};
const units:Record<string,SupplementLabel["facts"][number]["unit"]>={
  g:"g",mg:"mg",mcg:"μg","μg":"μg","mcg rae":"μg RAE","μg rae":"μg RAE","mcg dfe":"μg DFE","μg dfe":"μg DFE","mg ne":"mg NE","mg α-te":"mg α-TE",iu:"IU",cfu:"CFU",kcal:"kcal",
};
const names:Record<string,string>={
  "vitamin a":"비타민 A","vitamin c":"비타민 C","vitamin d":"비타민 D","vitamin d3":"비타민 D3","vitamin e":"비타민 E",
  thiamin:"티아민(B1)",thiamine:"티아민(B1)",riboflavin:"리보플라빈(B2)",niacin:"나이아신(B3)",
  "vitamin b6":"비타민 B6",folate:"엽산(B9)","vitamin b12":"비타민 B12",biotin:"비오틴(B7)",
  "pantothenic acid":"판토텐산(B5)",iodine:"요오드",magnesium:"마그네슘",zinc:"아연",
  selenium:"셀레늄",manganese:"망간",chromium:"크로뮴",molybdenum:"몰리브데넘",
};
const unitPattern="mcg(?: RAE| DFE)?|μg(?: RAE| DFE)?|mg(?: NE| α-TE)?|g|IU|CFU|kcal";
const amountPattern="(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?";
const rowPattern=new RegExp(`^(.+?)\\s+(${amountPattern})\\s*(${unitPattern})(?:\\s+(${amountPattern})\\s*%|\\s*[*†‡]+)?$`,"i");
const servingPattern=/^(?:serving size|1회 제공량|1회 섭취량)\s*[:：]?\s*\(?(\d+(?:\.\d+)?)\s*(?:level |rounded |vegetarian )?(tablets?|caplets?|capsules?|scoops?|soft\s?gels?|packets?|sachets?|drops?|ml|g|정|캡슐|스쿱|스푼|팩|포|방울|소프트젤)(?=$|\s|[()])/i;
const normalizedAmount=(raw:string)=>Number(raw.replaceAll(",",""));
const nihUnit=(text:string)=>text.normalize("NFKC").trim().toLowerCase().replace(/\(s\)$/,"").replace(/^(?:grams?)$/,"g").replace(/^(?:milligrams?)$/,"mg").replace(/^(?:micrograms?)$/,"mcg").replace(/^(?:calories?)$/,"kcal");
export const labelServingUnit=(text:string)=>servingUnits[nihUnit(text).replace(/s$/,"").replace(/^(?:vegetable|vegetarian|veggie|veg)\s+/,"").replaceAll(" ","")];
export const labelFactUnit=(text:string)=>units[nihUnit(text)];
export function labelFactName(text:string){
  const candidate=text.trim().split(" (")[0].toLowerCase();
  return Object.hasOwn(names,candidate)?names[candidate]:text.trim();
}

export function parseSupplementPhoto(text:string,url:string){
  const lines=text.normalize("NFKC").replaceAll("µ","μ").split(/\r?\n/).map(line=>line.trim().replace(/\s+/g," ")).filter(Boolean);
  const servingLine=lines.findIndex(line=>servingPattern.test(line));
  const serving=lines[servingLine]?.match(servingPattern);
  if(!serving)return null;
  const servingUnit=labelServingUnit(serving[2])??(serving[2]==="스푼"?"스쿱":"포");
  const facts:SupplementLabel["facts"]=[];
  let omitted=0;
  for(const line of lines.slice(servingLine+1)){
    if(/^(?:other ingredients|suggested use|warnings?|기타 성분|섭취 방법|주의사항)/i.test(line))break;
    if(/^(?:servings per container|amount per serving|%\s*(?:daily value|dv)|daily value|총 제공량|1회 제공량당|[*†‡])/i.test(line))continue;
    const row=line.match(rowPattern);
    if(!row||!/^[\p{L}]/u.test(row[1])||/[%<≤]/.test(row[1])||/\d\s*(?:mg|g|mcg|μg|IU|CFU)(?:\s|$)/i.test(row[1])){
      omitted++;
      continue;
    }
    facts.push({name:labelFactName(row[1]),rawName:row[1],nutrientId:nutrientIdentity(row[1]),amount:normalizedAmount(row[2]),unit:labelFactUnit(row[3]),
      dailyValuePercent:row[4]?normalizedAmount(row[4]):null});
  }
  const label=supplementLabelSchema.safeParse({productId:iherbProductId(url)??undefined,source:"photo",
    servingSize:Number(serving[1]),servingUnit,facts,partial:omitted>0});
  return label.success?{label:label.data,omitted}:null;
}
