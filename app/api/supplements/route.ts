import { getSessionUser } from "@/lib/auth";
import { createSupplementHandlers } from "@/lib/supplement-api";
import { supplementRepository } from "@/lib/supplement-repository";
export const dynamic="force-dynamic";
const handlers=createSupplementHandlers(async()=>(await getSessionUser())?.userId??null,supplementRepository);
export const GET=handlers.GET;
export const POST=handlers.POST;
