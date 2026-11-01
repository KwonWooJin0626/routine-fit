import { recommendationRequestSchema,RecommendationError,type RecommendationRequest,type RecommendationMemory } from "./recommendation-model";
export interface RecommendationRepository{get:(id:string,now:Date,includeDocument:boolean)=>Promise<{memory:RecommendationMemory;document?:unknown}>;mutate:(id:string,input:RecommendationRequest,now:Date)=>Promise<{memory:RecommendationMemory}>;}
const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export function createRecommendationHandlers(identity:()=>Promise<string|null>,repository:RecommendationRepository,clock=()=>new Date()){
  return {
    async GET(request:Request){const id=await identity();if(!id)return response({error:"로그인이 필요해요."},401);try{return response(await repository.get(id,clock(),new URL(request.url).searchParams.get("export")==="1"));}catch{return response({error:"추천 이력을 불러오지 못했어요."},503);}},
    async POST(request:Request){const id=await identity();if(!id)return response({error:"로그인이 필요해요."},401);if(request.headers.get("origin")!==new URL(request.url).origin)return response({error:"같은 사이트에서 요청해주세요."},403);
      let input:RecommendationRequest;try{const text=await request.text();if(text.length>12000)return response({error:"기록이 너무 길어요."},413);input=recommendationRequestSchema.parse(JSON.parse(text));}catch{return response({error:"추천 반응을 확인해주세요."},400);}
      try{return response(await repository.mutate(id,input,clock()));}catch(e){return e instanceof RecommendationError?response({error:e.message},e.status):response({error:"추천 반응을 저장하지 못했어요. 잠시 후 다시 시도해주세요."},503);}
    },
  };
}
