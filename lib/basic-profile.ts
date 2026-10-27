import { z } from "zod";
import { ingredientIds } from "./nutrition-profile";

export const sleepRanges = { under3:"3시간 미만", "3-5":"3~5시간 미만", "5-7":"5~7시간 미만", "7-9":"7~9시간 미만", over9:"9시간 이상", unknown:"잘 모르겠어요" } as const;
export const exerciseRanges = { none:"하지 않았어요", under60:"1시간 미만", "60-120":"1~2시간 미만", "120-240":"2~4시간 미만", over240:"4시간 이상", unknown:"잘 모르겠어요" } as const;
export const sittingRanges = { under4:"4시간 미만", "4-6":"4~6시간 미만", "6-8":"6~8시간 미만", over8:"8시간 이상", unknown:"잘 모르겠어요" } as const;
export const growthGoals = { balance:"작은 습관", study:"공부·집중", reading:"독서", organize:"생활 정리", recovery:"휴식·컨디션" } as const;
export const basicProfileSchema = z.object({
  version:z.literal(1),
  origin:z.enum(["range","legacy"]).optional(),
  height:z.number().min(100).max(230).nullable(), weight:z.number().min(25).max(300).nullable(),
  sleepRange:z.enum(["under3","3-5","5-7","7-9","over9","unknown"]),
  exerciseRange:z.enum(["none","under60","60-120","120-240","over240","unknown"]),
  sittingRange:z.enum(["under4","4-6","6-8","over8","unknown"]),
  supplementStatus:z.enum(["yes","none","unknown"]),
  supplements:z.array(z.enum([...ingredientIds,"multi"])).max(20),
  growthGoal:z.enum(["balance","study","reading","organize","recovery"]).default("balance"),
  focusTime:z.enum(["unknown","morning","afternoon","evening"]).default("unknown"),
  nutritionAgeKnown:z.boolean().optional(),
}).superRefine((p,ctx)=>{
  if(p.supplementStatus!=="yes"&&p.supplements.length)ctx.addIssue({code:"custom",message:"복용 여부와 선택한 영양제를 확인해주세요."});
  if(new Set(p.supplements).size!==p.supplements.length)ctx.addIssue({code:"custom",message:"중복된 성분이 있어요."});
});
export type BasicProfile=z.infer<typeof basicProfileSchema>;
export const emptyBasicProfile=():BasicProfile=>({version:1,height:null,weight:null,sleepRange:"unknown",exerciseRange:"unknown",sittingRange:"unknown",supplementStatus:"unknown",supplements:[],growthGoal:"balance",focusTime:"unknown"});
