import { z } from "zod";
import { supplementLabelSchema } from "@/lib/supplement-label";
import { labelFactName,labelFactUnit,labelServingUnit } from "@/lib/supplement-label-photo";

const base="https://api.ods.od.nih.gov/dsld/v9/";
const barcode=/^(?:\d{8}|\d{12,14})$/;
const searchSchema=z.object({hits:z.array(z.object({_id:z.string().regex(/^\d+$/)})),stats:z.object({count:z.number()})});
const labelSchema=z.object({
  id:z.number().int().positive(),fullName:z.string(),brandName:z.string(),upcSku:z.string(),offMarket:z.number(),
  servingsPerContainer:z.string(),
  servingSizes:z.array(z.object({order:z.number(),minQuantity:z.number(),maxQuantity:z.number(),unit:z.string(),inSFB:z.boolean()})),
  ingredientRows:z.array(z.object({name:z.string(),nestedRows:z.array(z.unknown()),quantity:z.array(z.object({
    servingSizeOrder:z.number(),operator:z.string().nullable(),quantity:z.number().nullable(),unit:z.string(),
    dailyValueTargetGroup:z.array(z.object({percent:z.number().nullable()})).optional(),
  }))})),
});

async function getData(path:string){
  const response=await fetch(base+path,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(5000),next:{revalidate:3600}});
  if(!response.ok)throw Error("DSLD unavailable");
  return response.json();
}

export async function GET(request:Request){
  const upc=new URL(request.url).searchParams.get("upc")??"";
  if(!barcode.test(upc))return Response.json({error:"바코드 번호를 확인해 주세요."},{status:400});
  try{
    const spaced=upc.length===12?`${upc[0]} ${upc.slice(1,6)} ${upc.slice(6,11)} ${upc[11]}`:upc;
    const searches=await Promise.all([...new Set([upc,spaced])].map(async value=>
      searchSchema.parse(await getData(`search-filter?${new URLSearchParams({q:`"${value}"`,size:"5"})}`))));
    if(searches.some(search=>search.stats.count>5))return Response.json({product:null});
    const ids=[...new Set(searches.flatMap(search=>search.hits.map(hit=>hit._id)))];
    const records=await Promise.all(ids.map(async id=>labelSchema.safeParse(await getData("label/"+id))));
    const matches=records.flatMap(parsed=>parsed.success&&parsed.data.offMarket===0&&parsed.data.upcSku.replaceAll(/\s|-/g,"")===upc?[parsed.data]:[]);
    if(matches.length!==1)return Response.json({product:null});
    const record=matches[0],servings=record.servingSizes.filter(s=>s.inSFB);
    if(servings.length!==1||servings[0].minQuantity!==servings[0].maxQuantity)return Response.json({product:null});
    const serving=servings[0],servingUnit=labelServingUnit(serving.unit);
    const facts=record.ingredientRows.flatMap(row=>{
      const amounts=row.quantity.filter(a=>a.servingSizeOrder===serving.order);
      if(amounts.length!==1)return [];
      const amount=amounts[0],unit=labelFactUnit(amount.unit);
      if(!unit||amount.quantity===null||amount.operator!=="=")return [];
      const dv=amount.dailyValueTargetGroup;
      return [{name:labelFactName(row.name),unit,amount:amount.quantity,dailyValuePercent:dv?.length===1?dv[0].percent:null}];
    });
    const servingsPerContainer=Number(record.servingsPerContainer)||undefined;
    const result=supplementLabelSchema.safeParse({upc,source:"dsld",dsldId:record.id,
      servingSize:serving.minQuantity,servingUnit,servingsPerContainer,facts,
      partial:facts.length!==record.ingredientRows.length||record.ingredientRows.some(row=>row.nestedRows.length>0)});
    return Response.json({product:result.success?{name:`${record.brandName} ${record.fullName}`.trim().slice(0,100),label:result.data}:null});
  }catch{
    return Response.json({error:"성분표 데이터베이스에 연결하지 못했어요."},{status:502});
  }
}
