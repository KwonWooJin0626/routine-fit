import { z } from "zod";

export const effectTypes=["study","work","exercise","growth","social","sleep","rest","leisure","none","meal"] as const;
export const effectLabels:Record<EffectType,string>={study:"학업·공부",work:"업무",exercise:"운동",growth:"자기계발",social:"교류",sleep:"수면",rest:"휴식",leisure:"여가",none:"준비·생활 기록",meal:"식사"};
export type EffectType=typeof effectTypes[number];
export const petSourceSchema=z.object({kind:z.enum(["routine","planner","sleep","manual"]),id:z.string().min(1).max(150),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict();
export type PetSource=z.infer<typeof petSourceSchema>;
export const sourceKey=(s:PetSource)=>`${s.kind}:${s.date}:${s.id}`;
export const executionInputSchema=z.object({
  title:z.string().trim().min(1).max(150),type:z.enum(effectTypes),start:z.string().datetime(),end:z.string().datetime(),
  intensity:z.enum(["light","moderate","high"]).default("moderate"),fullness:z.union([z.literal(30),z.literal(60),z.literal(80)]).optional(),
  source:petSourceSchema,status:z.enum(["done","partial"]).default("done"),linkTo:z.string().max(100).optional(),
}).strict();
export type ExecutionInput=z.infer<typeof executionInputSchema>;
export type PetExecution=Omit<ExecutionInput,"source"|"linkTo">&{id:string;sources:PetSource[];cancelled:boolean;feeling:"fresh"|"same"|"tired";updatedAt:string};
export type PetStats={stamina:number;maxStamina:number;stress:number;fullness:number;fitnessXP:number;fitnessTotalXP:number;learningXP:number;learningTotalXP:number;learningLevel:number};
export const initialPetStats=():PetStats=>({stamina:80,maxStamina:100,stress:30,fullness:60,fitnessXP:0,fitnessTotalXP:0,learningXP:0,learningTotalXP:0,learningLevel:1});
export type PetSeed={at:string;lastEvidenceAt:string;stats:PetStats};
export type PetDocument={version:1;ruleVersion:"2026-10-pet-v1";lifecycleId:string;adoptedAt:string;name:string;visible:boolean;reducedMotion:boolean;records:PetExecution[];seed:PetSeed;archivedCount:number;receipts:{key:string;hash:string}[]};
export type PetEffect={id:string;title:string;type:EffectType;end:string;stamina:number;stress:number;fitnessXP:number;learningXP:number;requestedFitnessXP:number;fullness?:number};
export type PetView={profile:{name:string;visible:boolean;reducedMotion:boolean;adoptedAt:string;archivedCount:number};stats:PetStats;baseState:"idle"|"tired";reasons:string[];evaluatedAt:string;changes:PetEffect[];todayFitnessXP:number;pausedByGap:boolean};
export type PetResult={document:PetDocument|null;view:PetView|null;revision:number;appRevision:number;reactionId?:string;duplicate?:boolean};
export const petCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("adopt"),name:z.string().trim().min(1).max(20)}).strict(),
  z.object({action:z.literal("record"),record:executionInputSchema}).strict(),
  z.object({action:z.literal("edit"),id:z.string().min(1).max(100),record:executionInputSchema}).strict(),
  z.object({action:z.literal("cancel"),id:z.string().min(1).max(100)}).strict(),
  z.object({action:z.literal("feeling"),id:z.string().min(1).max(100),feeling:z.enum(["fresh","same","tired"])}).strict(),
  z.object({action:z.literal("settings"),name:z.string().trim().min(1).max(20),visible:z.boolean(),reducedMotion:z.boolean()}).strict(),
  z.object({action:z.literal("reset"),confirm:z.literal("강아지 새로 시작")}).strict(),
]);
export type PetCommand=z.infer<typeof petCommandSchema>;
export const petRequestSchema=z.object({key:z.string().uuid(),revision:z.number().int().min(0),appRevision:z.number().int().min(1),command:petCommandSchema}).strict();
export type PetRequest=z.infer<typeof petRequestSchema>;
export class PetError extends Error{constructor(message:string,public status=400){super(message);}}
