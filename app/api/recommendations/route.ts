import { getSessionUser } from "@/lib/auth";
import { recommendationRepository } from "@/lib/recommendation-repository";
import { createRecommendationHandlers } from "@/lib/recommendation-api";
const handlers=createRecommendationHandlers(async()=>(await getSessionUser())?.userId??null,recommendationRepository);
export const GET=handlers.GET;
export const POST=handlers.POST;
