import { z } from "zod";
import { bookCategories,bookListUrl,musicCategories,musicQuery,musicSearchUrl,type BookCategory,type MusicCategory,type MediaCatalog,type MediaItem,type MediaContext } from "./media";

type Fetcher=(url:string,init?:RequestInit&{next?:{revalidate:number}})=>Promise<Response>;
const text=(value:string)=>value.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").slice(0,180);
const imageUrl=(value:string|undefined,host:string)=>{try{const u=new URL(value??"");return u.protocol==="https:"&&u.hostname===host?u.toString():undefined;}catch{return undefined;}};
export function isoSeconds(value:string){const m=value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]??0)*3600+Number(m[2]??0)*60+Number(m[3]??0):undefined;}
const youtubeItem=z.object({id:z.string().regex(/^[\w-]{11}$/),snippet:z.object({title:z.string(),channelTitle:z.string(),liveBroadcastContent:z.string().optional(),thumbnails:z.object({medium:z.object({url:z.string()}).optional()}).optional()}),contentDetails:z.object({duration:z.string(),regionRestriction:z.object({allowed:z.array(z.string()).optional(),blocked:z.array(z.string()).optional()}).optional()}),status:z.object({privacyStatus:z.string(),uploadStatus:z.string().optional()})});
export function parseYouTubeItems(raw:unknown,orderedIds:string[]):MediaItem[]{
  const data=z.object({items:z.array(z.unknown()).max(50)}).parse(raw);
  return data.items.flatMap(value=>{const p=youtubeItem.safeParse(value);if(!p.success)return [];const v=p.data,r=v.contentDetails.regionRestriction;if(!orderedIds.includes(v.id)||v.status.privacyStatus!=="public"||v.status.uploadStatus&&v.status.uploadStatus!=="processed"||v.snippet.liveBroadcastContent&&v.snippet.liveBroadcastContent!=="none"||r?.blocked?.includes("KR")||r?.allowed&&!r.allowed.includes("KR"))return [];return [{id:v.id,title:text(v.snippet.title),creator:text(v.snippet.channelTitle),url:`https://www.youtube.com/watch?v=${v.id}`,image:imageUrl(v.snippet.thumbnails?.medium?.url,"i.ytimg.com"),seconds:isoSeconds(v.contentDetails.duration)}];}).sort((a,b)=>orderedIds.indexOf(a.id)-orderedIds.indexOf(b.id));
}
export function createMediaCatalogProvider({youtubeKey,fetcher=fetch}:{youtubeKey?:string;fetcher?:Fetcher}){
  async function get(url:URL){const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(8000),next:{revalidate:86400}});if(!r.ok)throw Error("provider unavailable");return {raw:await r.json(),checkedAt:new Date(r.headers.get("date")??Date.now()).toISOString()};}
  return async(kind:"book"|"music",key:string,novel:"korean"|"english"|"japanese"="korean",context:MediaContext="rest"):Promise<MediaCatalog>=>{
    if(!(kind==="book"?bookCategories:musicCategories).some(c=>c.id===key))throw Error("unknown category");
    const sourceUrl=kind==="book"?bookListUrl(key as BookCategory,novel):musicSearchUrl(key as MusicCategory,context),base={kind,key,sourceUrl,items:[]};
    // Aladin retired its OpenAPI on 2026-10-30; books always use official links.
    if(kind==="book")return {...base,mode:"links",message:"알라딘 공식 분야별 베스트셀러에서 상위 10권을 확인하고 원하는 책을 등록하세요."};
    if(!youtubeKey)return {...base,mode:"links"};
    try{
      const search=new URL("https://www.googleapis.com/youtube/v3/search");for(const [k,v] of Object.entries({key:youtubeKey!,part:"snippet",type:"video",q:musicQuery(key as MusicCategory,context),order:"relevance",safeSearch:"strict",regionCode:"KR",maxResults:"15"}))search.searchParams.set(k,v);
      const found=await get(search),parsed=z.object({items:z.array(z.object({id:z.object({videoId:z.string().regex(/^[\w-]{11}$/)})})).max(50)}).parse(found.raw),ids=[...new Set(parsed.items.map(v=>v.id.videoId))];
      if(!ids.length)return {...base,mode:"live",checkedAt:found.checkedAt};
      const details=new URL("https://www.googleapis.com/youtube/v3/videos");details.searchParams.set("key",youtubeKey!);details.searchParams.set("part","snippet,contentDetails,status");details.searchParams.set("id",ids.join(","));
      const result=await get(details);return {...base,mode:"live",items:parseYouTubeItems(result.raw,ids),checkedAt:found.checkedAt};
    }catch{return {...base,mode:"unavailable",message:"후보 정보를 불러오지 못했어요. 공식 목록·검색에서 직접 골라보세요."};}
  };
}
