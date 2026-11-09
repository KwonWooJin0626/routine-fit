import { z } from "zod";
import { SupplementInputError,supplementCommandSchema,emptySupplementJournal,applySupplementCommand,supplementJournalSchema,type SupplementJournal } from "./supplement-journal";
import type { AppState } from "./model";
type Result={journal:SupplementJournal;revision:number};
export type SupplementRepository={read:(userId:string)=>Promise<Result>;mutate:(userId:string,revision:number,apply:(journal:SupplementJournal,app:AppState)=>SupplementJournal)=>Promise<Result|null>};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const inputSchema=z.object({revision:z.number().int().min(0),command:supplementCommandSchema});
export function createSupplementHandlers(identity:()=>Promise<string|null>,repository:SupplementRepository,clock=()=>new Date()){
  return {
    async GET(){const userId=await identity();if(!userId)return reply({error:"로그인이 필요해요."},401);try{const data=await repository.read(userId);return reply({...data,journal:supplementJournalSchema.parse(data.journal??emptySupplementJournal())});}catch{return reply({error:"복용 기록을 불러오지 못했어요. 다시 시도해주세요."},503);}},
    async POST(request:Request){
      const userId=await identity();if(!userId)return reply({error:"로그인이 필요해요."},401);
      if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"같은 사이트에서 요청해주세요."},403);
      let input:z.infer<typeof inputSchema>;try{const body=await request.text();if(body.length>40000)return reply({error:"입력 데이터가 너무 커요."},413);input=inputSchema.parse(JSON.parse(body));}catch{return reply({error:"제품·날짜·시각 입력을 확인해주세요."},400);}
      try{const data=await repository.mutate(userId,input.revision,(journal,app)=>applySupplementCommand(journal,input.command,app,clock()));return data?reply(data):reply({error:"다른 창에서 기록이 변경됐어요. 최신 기록을 불러온 뒤 다시 시도해주세요."},409);}catch(e){if(e instanceof SupplementInputError)return reply({error:e.message},400);return reply({error:"복용 기록을 저장하지 못했어요. 다시 시도해주세요."},503);}
    },
  };
}
