import { z } from "zod";

export const allergenLabels = { milk:"우유", egg:"달걀", soy:"대두", fish:"생선", shellfish:"갑각류·조개류", nuts:"견과류", peanut:"땅콩", wheat:"밀", sesame:"참깨", other:"기타" } as const;
export const ingredientIds = ["protein","b12","bcomplex","c","d","a","e","k","b5","biotin","omega","zinc","magnesium","calcium","iron","creatine","eaa","bcaa","milkthistle"] as const;
export const nutritionProfileSchema = z.object({
  reviewed:z.boolean().default(false),
  allergyStatus:z.enum(["unknown","none","known"]).default("unknown"),
  allergens:z.array(z.enum(["milk","egg","soy","fish","shellfish","nuts","peanut","wheat","sesame","other"])).max(10).default([]),
  allergyNotes:z.string().max(250).default(""),
  lactose:z.enum(["unknown","comfortable","discomfort"]).default("unknown"),
  digestiveNotes:z.string().max(250).default(""),
  avoidFoods:z.string().max(250).default(""),
  proteinSource:z.enum(["both","dairy","plant"]).default("both"),
  proteinIntake:z.enum(["unknown","adequate","difficult"]).default("unknown"),
  format:z.enum(["unsure","single","multi","both"]).default("unsure"),
  budget:z.enum(["any","value","convenience"]).default("any"),
  interests:z.array(z.enum(ingredientIds)).max(19).default([]),
}).superRefine((p,ctx)=>{
  if(p.reviewed && p.allergyStatus==="known" && !p.allergens.length)ctx.addIssue({code:"custom",path:["allergens"],message:"알레르기가 있는 원료를 선택해주세요. 모르면 ‘잘 모르겠어요’를 선택하세요."});
  if(p.reviewed && p.allergyStatus!=="known" && p.allergens.length)ctx.addIssue({code:"custom",path:["allergens"],message:"알레르기 원료와 확인 상태를 다시 확인해주세요."});
});
export type NutritionProfile = z.infer<typeof nutritionProfileSchema>;
export const emptyNutritionProfile = ():NutritionProfile => nutritionProfileSchema.parse({});
