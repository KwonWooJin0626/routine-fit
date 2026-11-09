import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userStates,petCompanions,sleepRecords } from "@/db/schema";
import { stateSchema,type AppState } from "./model";
import { calculatePet,compactPet } from "./pet-engine";
import { commandAlreadyApplied,projectPetRecords } from "./pet-actions";
import { PetError,type PetDocument,type PetRequest,type PetResult } from "./pet-model";
import type { SleepRecord } from "./sleep";
import { executionsOverlap } from "./pet-execution";
import { syncStoredRecommendations } from "./recommendation-repository";

import { applyJournalCommand,humanDocument } from "./activity-journal";

type DB=ReturnType<typeof getDb>;
export type PetTransaction=Parameters<Parameters<DB["transaction"]>[0]>[0];
export const readPetDocument=(payload:string):PetDocument=>JSON.parse(payload) as PetDocument;
async function lockedUser(tx:PetTransaction,userId:string){const [row]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");if(!row)throw new PetError("기초 질문을 먼저 저장해주세요.",409);return row;}
export const petRepository={
  async get(userId:string,now=new Date()):Promise<PetResult>{
    return getDb().transaction(async tx=>{
      const [user]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");
      if(!user)return {document:null,view:null,revision:0,appRevision:0};
      const [row]=await tx.select().from(petCompanions).where(eq(petCompanions.userId,userId));
      if(!row)return {document:null,view:null,revision:0,appRevision:user.revision};
      const old=readPetDocument(row.payload),document=compactPet(old,now);let revision=row.revision;
      const app=stateSchema.parse(JSON.parse(user.payload));
      if(!app.activityJournal){app.activityJournal={records:old.records,receipts:old.receipts};user.revision++;await tx.update(userStates).set({payload:JSON.stringify(app),revision:user.revision,updatedAt:now.toISOString()}).where(eq(userStates.userId,userId));}
      if(document.seed.at!==old.seed.at){revision++;await tx.update(petCompanions).set({payload:JSON.stringify(document),revision,updatedAt:now.toISOString()}).where(eq(petCompanions.userId,userId));}
      return {document,view:calculatePet(document,now),revision,appRevision:user.revision};
    });
  },
  async mutate(userId:string,input:PetRequest,now=new Date()):Promise<PetResult&{app:AppState}>{
    return getDb().transaction(async tx=>{
      const user=await lockedUser(tx,userId),[row]=await tx.select().from(petCompanions).where(eq(petCompanions.userId,userId));
      const old=row?readPetDocument(row.payload):null,app=stateSchema.parse(JSON.parse(user.payload));
      if(commandAlreadyApplied(humanDocument(app,old),input))return {document:old,view:old?calculatePet(old,now):null,revision:row?.revision??0,appRevision:user.revision,app,duplicate:true};
      if((row?.revision??0)!==input.revision||user.revision!==input.appRevision)throw new PetError("다른 창에서 기록이 바뀌었어요. 최신 내용을 불러온 뒤 다시 확인해주세요.",409);
      const sleeps=(await tx.select().from(sleepRecords).where(eq(sleepRecords.userId,userId))) as SleepRecord[];
      const result=applyJournalCommand(old,app,input,now,sleeps),revision=(row?.revision??0)+1,appRevision=user.revision+1;
      if(!stateSchema.safeParse(result.app).success)throw new PetError("저장 가능한 활동 기록 범위를 확인해주세요. 기존 기록은 유지됐어요.");
      const values={userId,payload:JSON.stringify(result.document),revision,updatedAt:now.toISOString()};
      if(result.document)await tx.insert(petCompanions).values(values).onConflictDoUpdate({target:petCompanions.userId,set:values});
      await tx.update(userStates).set({payload:JSON.stringify(result.app),revision:appRevision,updatedAt:now.toISOString()}).where(eq(userStates.userId,userId));
      await syncStoredRecommendations(tx,userId,app,result.app,undefined,now);
      return {document:result.document,view:result.document?calculatePet(result.document,now):null,revision:result.document?revision:0,appRevision,app:result.app,reactionId:result.reactionId};
    });
  },
};

// Called inside the sleep write transaction, after locking user_states first.
export async function syncPetSleep(tx:PetTransaction,userId:string,now=new Date()){
  const [user]=await tx.select().from(userStates).where(eq(userStates.userId,userId));if(!user)return;
  const [row]=await tx.select().from(petCompanions).where(eq(petCompanions.userId,userId));
  const game=row?readPetDocument(row.payload):null,app=stateSchema.parse(JSON.parse(user.payload)),doc=humanDocument(app,game);
  const sleeps=await tx.select().from(sleepRecords).where(eq(sleepRecords.userId,userId));let changed=false;
  for(const record of doc.records.filter(r=>!r.cancelled&&r.type==="sleep")){
    const source=record.sources.find(s=>s.kind==="sleep");if(!source)continue;
    const start=sleeps.find(r=>r.sessionDate===source.date&&r.kind==="bed")?.actualAt,end=sleeps.find(r=>r.sessionDate===source.date&&r.kind==="wake")?.actualAt;
    if(!start||!end){record.cancelled=true;record.updatedAt=now.toISOString();changed=true;continue;}
    if(record.start===start&&record.end===end)continue;
    if(start>=end||Date.parse(end)>now.getTime()||Date.parse(end)-Date.parse(start)>24*3600000)throw new PetError("취침·기상 구간을 다시 확인해주세요.");
    if(doc.records.some(r=>!r.cancelled&&r.type!=="meal"&&r.id!==record.id&&executionsOverlap(r,{start,end})))throw new PetError("수면 구간이 다른 실제 수행과 겹쳐요. 수행 시각을 먼저 확인해주세요.",409);
    record.start=start;record.end=end;record.updatedAt=now.toISOString();changed=true;
  }
  if(changed){
    app.activityJournal={records:doc.records,receipts:doc.receipts};
    await tx.update(userStates).set({payload:JSON.stringify(app),revision:user.revision+1,updatedAt:now.toISOString()}).where(eq(userStates.userId,userId));
    if(game&&row){game.records=doc.records.filter(r=>r.end>=game.seed.at);calculatePet(game,now);await tx.update(petCompanions).set({payload:JSON.stringify(game),revision:row.revision+1,updatedAt:now.toISOString()}).where(eq(petCompanions.userId,userId));}
  }
}
