import { PetError,petRequestSchema,type PetRequest,type PetResult } from "./pet-model";
export interface PetRepository{get:(userId:string,now:Date)=>Promise<PetResult>;mutate:(userId:string,input:PetRequest,now:Date)=>Promise<PetResult>;}
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export function createPetHandlers(identity:()=>Promise<string|null>,repository:PetRepository,clock=()=>new Date()){
  return {
    async GET(){const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);try{return response(await repository.get(user,clock()));}catch{return response({error:"강아지 기록을 불러오지 못했어요. 다시 시도해주세요."},503);}},
    async POST(request:Request){
      const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);
      if(request.headers.get("origin")!==new URL(request.url).origin)return response({error:"같은 사이트에서 요청해주세요."},403);
      let input:PetRequest;try{const raw=await request.text();if(raw.length>12000)return response({error:"입력이 너무 길어요."},413);input=petRequestSchema.parse(JSON.parse(raw));}catch{return response({error:"기록 내용을 확인해주세요."},400);}
      try{return response(await repository.mutate(user,input,clock()));}catch(e){return e instanceof PetError?response({error:e.message},e.status):response({error:"저장하지 못했어요. 입력은 유지되며 같은 요청으로 다시 시도할 수 있어요."},503);}
    },
  };
}
