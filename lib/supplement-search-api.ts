import { z } from "zod";
import { iherbProductId } from "./supplement-label";
import { LiveSearchError,type LiveQuery } from "./supplement-live-search";

const input=z.object({name:z.string().trim().max(200).default(""),url:z.string().max(1000).optional()})
  .refine(v=>v.name.length>=2||!!v.url,"제품명이나 상품 링크를 입력해 주세요.")
  .refine(v=>!v.url||!!iherbProductId(v.url),"iHerb 상품 상세 페이지 링크를 입력해 주세요.");
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});

export function createSupplementSearchHandler(identity:()=>Promise<string|null>,search:(query:LiveQuery)=>Promise<unknown>,clock=()=>Date.now()){
  // Instance-local request guards supplement provider quotas. No product cache/DB.
  const attempts=new Map<string,{until:number;count:number;running:boolean}>();
  return async function POST(request:Request){
    if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"같은 사이트에서 요청해 주세요."},403);
    const owner=await identity();if(!owner)return reply({error:"로그인하면 제품 정보를 실시간으로 찾을 수 있어요."},401);
    let query:LiveQuery;
    try{const body=await request.text();if(body.length>3000)return reply({error:"검색어가 너무 길어요."},413);query=input.parse(JSON.parse(body));}
    catch{return reply({error:"정확한 제품명이나 iHerb 상품 링크를 입력해 주세요."},400);}
    const now=clock();for(const [key,value] of attempts)if(value.until<=now&&!value.running)attempts.delete(key);
    const limit=attempts.get(owner)??{until:now+60000,count:0,running:false};
    if(limit.running)return reply({error:"이전 제품 조회가 끝난 뒤 다시 검색해 주세요.",code:"SEARCH_IN_PROGRESS"},429);
    if(limit.count>=4||attempts.size>=4096)return reply({error:"잠시 후 다시 조회해 주세요.",code:"RATE_LIMITED"},429);
    limit.count++;limit.running=true;attempts.set(owner,limit);
    try{return reply(await search(query));}
    catch(e){
      if(e instanceof LiveSearchError)return reply({error:e.message,code:e.code},e.status);
      return reply({error:"성분표 조회가 지연되고 있어요. 잠시 후 다시 시도해 주세요.",code:"LOOKUP_FAILED"},502);
    }finally{limit.running=false;}
  };
}
