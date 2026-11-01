import { z } from "zod";

export const RECOMMENDATION_VERSION="adaptive-2026-11-01-v1";
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const recommendationMetaSchema=z.object({batchId:z.string().max(90),version:z.literal(RECOMMENDATION_VERSION),date,requested:z.number().int().min(3).max(5),limited:z.boolean()});
export type RecommendationMeta=z.infer<typeof recommendationMetaSchema>;
export const recommendationIntentSchema=z.object({kind:z.enum(["add","remove","restore"]),date,routineId:z.string().min(1).max(100)}).strict();
export type RecommendationIntent=z.infer<typeof recommendationIntentSchema>;
export const recommendationEventSchema=z.object({kind:z.enum(["catalog_view","recommendation_view","detail","search"]),date,routineId:z.string().min(1).max(100)}).strict();
export type RecommendationEvent=z.infer<typeof recommendationEventSchema>;
export const recommendationRequestSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("events"),events:z.array(recommendationEventSchema).min(1).max(25)}).strict(),
  z.object({action:z.literal("settings"),count:z.number().int().min(3).max(5)}).strict(),
  z.object({action:z.literal("exclude"),date,routineId:z.string().min(1).max(100),reason:z.enum(["generic","dislike","time","condition","schedule","cleanup","never"])}).strict(),
  z.object({action:z.literal("unblock"),canonicalId:z.string().min(1).max(100)}).strict(),
]);
export type RecommendationRequest=z.infer<typeof recommendationRequestSchema>;
export type RecommendationSignal={date:string;canonicalId:string;title:string;routineIds:string[];catalogSeen?:boolean;recommendationSeen?:boolean;interestWeight:number;selected?:boolean;status?:"done"|"partial"|"skipped";skipReason?:string;removed?:boolean;removalReason?:string;withdrawn?:boolean;censored?:boolean};
export type BehaviorScore={execution:number;interest:number;deletion:number;observations:number;recentDates:string[]};
export type RecommendationMemory={version:typeof RECOMMENDATION_VERSION;seed:string;revision:number;count:3|4|5;stats:Record<string,BehaviorScore>;blocked:{id:string;title:string}[];excludedToday:string[]};
export type RecommendationParts={context:number;execution:number;interest:number;deletion:number;repeat:number};
export type RecommendationAudit={meta:RecommendationMeta;context:{date:string;availableMinutes:number;generation:number;seed:number;memoryRevision:number};choices:{routineId:string;canonicalId:string;position:number;probability:number;score:number;parts:RecommendationParts;pool:{id:string;score:number;parts:RecommendationParts}[]}[]};
export type RecommendationDocument={version:1;seed:string;count:3|4|5;signals:RecommendationSignal[];blocked:{id:string;title:string}[];batches:RecommendationAudit[]};
export const emptyRecommendationDocument=():RecommendationDocument=>({version:1,seed:crypto.randomUUID(),count:3,signals:[],blocked:[],batches:[]});
export const emptyRecommendationMemory=():RecommendationMemory=>({version:RECOMMENDATION_VERSION,seed:"neutral",revision:0,count:3,stats:{},blocked:[],excludedToday:[]});
export type RecommendationOptions={memory:RecommendationMemory;budget?:number;retained?:import("./model").Routine[];onBatch?:(batch:RecommendationAudit)=>void};
export class RecommendationError extends Error{constructor(message:string,public status=400){super(message);}}
