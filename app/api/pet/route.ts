import { getSessionUser } from "@/lib/auth";
import { createPetHandlers } from "@/lib/pet-api";
import { petRepository } from "@/lib/pet-repository";
const handlers=createPetHandlers(async()=>(await getSessionUser())?.userId??null,petRepository);
export const GET=handlers.GET;
export const POST=handlers.POST;
