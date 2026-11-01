import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userStates,recommendationProfiles } from "@/db/schema";
import { stateSchema,type AppState,type Day } from "./model";
import { applyRecommendationRequest,compactRecommendationDocument,recommendationMemory,syncRecommendationState } from "./recommendation-learning";
import { emptyRecommendationDocument,emptyRecommendationMemory,RecommendationError,type RecommendationAudit,type RecommendationDocument,type RecommendationIntent,type RecommendationOptions,type RecommendationRequest } from "./recommendation-model";
import type { PetTransaction } from "./pet-repository";
import { routineShadowModel } from "./recommendation-shadow";

async function read(tx:PetTransaction,userId:string){const [row]=await tx.select().from(recommendationProfiles).where(eq(recommendationProfiles.userId,userId));return {row,document:row?JSON.parse(row.payload) as RecommendationDocument:emptyRecommendationDocument()};}
async function write(tx:PetTransaction,userId:string,document:RecommendationDocument,revision:number,now:Date){const value={userId,payload:JSON.stringify(document),revision,updatedAt:now.toISOString()};await tx.insert(recommendationProfiles).values(value).onConflictDoUpdate({target:recommendationProfiles.userId,set:value});}
export async function syncStoredRecommendations(tx:PetTransaction,userId:string,before:AppState|null,after:AppState,intent?:RecommendationIntent,now=new Date()){
  const {row,document}=await read(tx,userId),doc=compactRecommendationDocument(document,now);syncRecommendationState(doc,before,after,intent,now);await write(tx,userId,doc,(row?.revision??0)+1,now);
}
export const recommendationRepository={
  async get(userId:string,now=new Date(),includeDocument=false){return getDb().transaction(async tx=>{
    const [user]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");if(!user)return {memory:emptyRecommendationMemory(),...(includeDocument?{document:null}:{})};
    const {row,document}=await read(tx,userId),doc=compactRecommendationDocument(document,now);let revision=row?.revision??0;
    if(!row){syncRecommendationState(doc,null,stateSchema.parse(JSON.parse(user.payload)),undefined,now);revision=1;await write(tx,userId,doc,revision,now);}
    else if(JSON.stringify(doc)!==row.payload){revision++;await write(tx,userId,doc,revision,now);}
    return {memory:recommendationMemory(doc,revision,now),...(includeDocument?{document:doc}:{})};
  });},
  async mutate(userId:string,input:RecommendationRequest,now=new Date()){return getDb().transaction(async tx=>{
    const [user]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");if(!user)throw new RecommendationError("기초 질문을 먼저 저장해주세요.",409);
    const {row,document}=await read(tx,userId),doc=compactRecommendationDocument(document,now),app=stateSchema.parse(JSON.parse(user.payload));
    if(!row)syncRecommendationState(doc,null,app,undefined,now);
    applyRecommendationRequest(doc,app,input,now);const revision=(row?.revision??0)+1;await write(tx,userId,doc,revision,now);return {memory:recommendationMemory(doc,revision,now)};
  });},
  async plan(userId:string,build:(options:RecommendationOptions)=>Day,now=new Date()){return getDb().transaction(async tx=>{
    const [user]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");
    // The first plan can precede profile creation. No fake propensity log is
    // reconstructed for that bootstrap batch; future persisted batches are audited.
    if(!user)return build({memory:{...emptyRecommendationMemory(),seed:userId}});
    const {row,document}=await read(tx,userId),doc=compactRecommendationDocument(document,now);if(!row)syncRecommendationState(doc,null,stateSchema.parse(JSON.parse(user.payload)),undefined,now);
    const app=stateSchema.parse(JSON.parse(user.payload));
    let batch:RecommendationAudit|undefined;const day=build({memory:recommendationMemory(doc,row?.revision??0,now),learning:{batchId:`rec-${crypto.randomUUID()}`,generatedAt:now.toISOString(),interests:app.media?.interests??[]},shadowModel:routineShadowModel,onBatch:b=>{batch=b;}});
    if(batch){doc.batches=[...doc.batches.filter(b=>b.meta.batchId!==batch!.meta.batchId),batch].slice(-180);await write(tx,userId,doc,(row?.revision??0)+1,now);}return day;
  });},
};
