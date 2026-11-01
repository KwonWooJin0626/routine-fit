import { getSessionUser } from "@/lib/auth";
import { recommendationRepository } from "@/lib/recommendation-repository";
import { createMLTrainingHandler } from "@/lib/routine-ml-api";
import { routineShadowModel } from "@/lib/recommendation-shadow";
export const GET=createMLTrainingHandler(async()=>(await getSessionUser())?.userId??null,async id=>(await recommendationRepository.get(id,new Date(),true)).document??null,()=>new Date(),routineShadowModel?.modelId??null);
