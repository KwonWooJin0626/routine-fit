import { createDsldLookup } from "@/lib/supplement-dsld";

export const dynamic="force-dynamic";
const lookup=createDsldLookup();
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,name=params.get("name")?.trim();
  if(name){
    if(name.length<2||name.length>100)return json({error:"제품명을 2~100자로 입력해 주세요."},400);
    try{return json({products:await lookup.byName(name)});}catch{return json({error:"NIH 제품명 검색에 연결하지 못했어요."},502);}
  }
  const upc=params.get("upc")??"";
  if(!/^(?:\d{8}|\d{12,14})$/.test(upc))return json({error:"바코드 번호를 확인해 주세요."},400);
  try{return json({product:await lookup.byBarcode(upc)});}catch{return json({error:"성분표 데이터베이스에 연결하지 못했어요."},502);}
}
