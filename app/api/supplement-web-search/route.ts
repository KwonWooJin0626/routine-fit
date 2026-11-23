import { getSessionUser } from "@/lib/auth";
import { lookupLiveSupplement } from "@/lib/supplement-live-search";
import { createSupplementSearchHandler } from "@/lib/supplement-search-api";

export const dynamic="force-dynamic";
export const maxDuration=60;
export const POST=createSupplementSearchHandler(
  async()=>(await getSessionUser())?.userId??null,
  query=>lookupLiveSupplement(query,process.env.GEMINI_FREE_SEARCH_API_KEY?.trim()??""),
);
