import { nutrientIdentity } from "./supplement-nutrients";
import { z } from "zod";
import { supplementLabelSchema } from "./supplement-label";
import { labelFactName,labelFactUnit,labelServingUnit } from "./supplement-label-photo";
import { parseDailyLabelUse } from "./supplement-serving";
import { supplementNihQuery } from "./supplement-query";

export function createDsldLookup(fetcher:typeof fetch=fetch){
const base="https://api.ods.od.nih.gov/dsld/v9/";
const barcode=/^(?:\d{8}|\d{12,14})$/;
const searchSchema=z.object({hits:z.array(z.object({_id:z.string().regex(/^\d+$/)})),stats:z.object({count:z.number()})});
const labelSchema=z.object({
  id:z.number().int().positive(),fullName:z.string(),brandName:z.string(),upcSku:z.string(),offMarket:z.number(),
  servingsPerContainer:z.string(),netContents:z.array(z.object({display:z.string()})).optional(),
  statements:z.array(z.object({type:z.string(),notes:z.string()})).optional(),
  servingSizes:z.array(z.object({order:z.number(),minQuantity:z.number(),maxQuantity:z.number(),unit:z.string(),notes:z.string().nullish(),inSFB:z.boolean()})),
  ingredientRows:z.array(z.object({name:z.string(),nestedRows:z.array(z.unknown()),quantity:z.array(z.object({
    servingSizeOrder:z.number(),operator:z.string().nullable(),quantity:z.number().nullable(),unit:z.string(),
    dailyValueTargetGroup:z.array(z.object({percent:z.number().nullable()})).optional(),
  }))})),
});

async function getData(path:string){
  const response=await fetcher(base+path,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(5000),cache:"no-store"});
  if(!response.ok)throw Error("DSLD unavailable");
  return response.json();
}

function toProduct(record:z.infer<typeof labelSchema>,upc?:string){
  const servings=record.servingSizes.filter(s=>s.inSFB);
  if(servings.length!==1||servings[0].minQuantity!==servings[0].maxQuantity)return null;
  const serving=servings[0];
  // NIH sometimes stores the mass as the serving and the scoop equivalent in notes.
  const scoop=labelServingUnit(serving.unit)==="g"?serving.notes?.trim().match(/^(\d+(?:\.\d+)?)\s+(?:(?:slightly\s+rounded|rounded|level)\s+)?scoops?$/i):null;
  const servingUnit=scoop?"스쿱":labelServingUnit(serving.unit),servingSize=scoop?Number(scoop[1]):serving.minQuantity;
  type Row=z.infer<typeof labelSchema>["ingredientRows"][number];
  const rowShape=labelSchema.shape.ingredientRows.element;
  const rows:Row[]=[];let incomplete=false;
  function collect(items:unknown[],depth=0){
    if(depth>8){incomplete=true;return;}
    for(const item of items){const parsed=rowShape.safeParse(item);if(!parsed.success||rows.length>=80){incomplete=true;continue;}rows.push(parsed.data);collect(parsed.data.nestedRows,depth+1);}
  }
  collect(record.ingredientRows);
  const facts=rows.flatMap(row=>{
    const amounts=row.quantity.filter(a=>a.servingSizeOrder===serving.order);
    if(amounts.length!==1)return [];
    const amount=amounts[0],unit=labelFactUnit(amount.unit);
    if(!unit||amount.quantity===null||amount.operator!=="=")return [];
    const dv=amount.dailyValueTargetGroup;
    return [{name:labelFactName(row.name),rawName:row.name,rawAmount:amount.quantity,rawUnit:amount.unit,nutrientId:nutrientIdentity(row.name),unit,amount:amount.quantity,dailyValuePercent:dv?.length===1?dv[0].percent:null}];
  });
  const servingsPerContainer=Number(record.servingsPerContainer)||undefined;
  const dailyUseText=record.statements?.filter(s=>s.type==="Suggested/Recommended/Usage/Directions").map(s=>s.notes).join("\n").slice(0,2000)||undefined;
  const result=supplementLabelSchema.safeParse({upc,source:"dsld",dsldId:record.id,retrievedAt:new Date().toISOString(),webSources:[{title:"NIH 원본 성분표",url:`https://dsld.od.nih.gov/label/${record.id}`}],
    servingSize,servingUnit,servingsPerContainer,facts,dailyUseText,dailyUnits:servingUnit&&dailyUseText?parseDailyLabelUse(dailyUseText,servingUnit):undefined,
    partial:incomplete||facts.length!==rows.length});
  return result.success?{name:`${record.brandName} ${record.fullName}`.trim().slice(0,100),label:result.data}:null;
}

async function findByName(name:string){
  const searchName=supplementNihQuery(name,"");
  const query=new URLSearchParams({q:searchName,status:"1",sort_by:"_score",sort_order:"desc",size:"12"});
  const matches=z.object({hits:z.array(z.object({_id:z.string().regex(/^\d+$/)}))})
    .parse(await getData("search-filter?"+query));
  const ids=[...new Set(matches.hits.map(hit=>hit._id))].slice(0,12);
  const labels=await Promise.allSettled(ids.map(id=>getData("label/"+id)));
  return labels.flatMap(result=>{
    if(result.status!=="fulfilled")return [];
    const parsed=labelSchema.safeParse(result.value);
    if(!parsed.success||parsed.data.offMarket!==0)return [];
    const record=parsed.data,upc=record.upcSku.replaceAll(/\s|-/g,"");
    const searchable=[record.brandName,record.fullName,...(record.netContents??[]).map(p=>p.display)].join(" ").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
    const terms=searchName.normalize("NFKC").toLowerCase().replace(/,/g,"").split(/[^\p{L}\p{N}]+/u).filter(t=>t&&!new Set(["with","and","from","of","the","usp","grade"]).has(t));
    if(!terms.every(term=>searchable.includes(term)))return [];
    const product=toProduct(record,barcode.test(upc)?upc:undefined);
    if(product)product.label.query=name;
    return product?[{...product,pack:record.netContents?.map(item=>item.display).join(" · ")}]:[];
  }).slice(0,5);
}


async function byBarcode(upc:string){
    const spaced=upc.length===12?`${upc[0]} ${upc.slice(1,6)} ${upc.slice(6,11)} ${upc[11]}`:upc;
    const searches=await Promise.all([...new Set([upc,spaced])].map(async value=>
      searchSchema.parse(await getData(`search-filter?${new URLSearchParams({q:`"${value}"`,size:"5"})}`))));
    if(searches.some(search=>search.stats.count>5))return null;
    const ids=[...new Set(searches.flatMap(search=>search.hits.map(hit=>hit._id)))];
    const records=await Promise.all(ids.map(async id=>labelSchema.safeParse(await getData("label/"+id))));
    const matches=records.flatMap(parsed=>parsed.success&&parsed.data.offMarket===0&&parsed.data.upcSku.replaceAll(/\s|-/g,"")===upc?[parsed.data]:[]);
    if(matches.length!==1)return null;
    return toProduct(matches[0],upc);
}
return {byName:findByName,byBarcode};
}
