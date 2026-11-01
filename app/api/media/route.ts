import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createMediaCatalogProvider } from "@/lib/media-providers";
export async function GET(request:Request){
  if(!await getSessionUser())return Response.json({error:"로그인이 필요합니다."},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const params=new URL(request.url).searchParams,input=z.object({kind:z.enum(["book","music"]),key:z.string().max(30),novel:z.enum(["korean","english","japanese"]).default("korean"),context:z.enum(["reading","focus","rest","morning","reflection","bedtime","meditation","walking","exercise","organize","relationships"]).default("rest")}).strict().safeParse(Object.fromEntries(params));
  if(!input.success)return Response.json({error:"추천 분야를 확인해주세요."},{status:400});
  try{const provider=createMediaCatalogProvider({youtubeKey:process.env.YOUTUBE_API_KEY});return Response.json(await provider(input.data.kind,input.data.key,input.data.novel,input.data.context),{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"추천 분야를 확인해주세요."},{status:400});}
}
