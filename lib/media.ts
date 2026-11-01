import { z } from "zod";

export const bookCategories = [
  {id:"poetry",label:"시",cid:50940,contexts:["rest","reading","bedtime","reflection"]},
  {id:"fiction",label:"소설",cid:50917,contexts:["reading","rest"]},
  {id:"essay",label:"에세이",cid:55889,contexts:["reading","rest","morning","reflection","bedtime"]},
  {id:"logic",label:"논리와 비판적 사고",cid:51412,contexts:["focus","reading"]},
  {id:"healing",label:"힐링",cid:70236,contexts:["rest","reflection","bedtime"]},
  {id:"relationships",label:"인간관계",cid:2951,contexts:["relationships","reflection"]},
  {id:"happiness",label:"행복론",cid:70211,contexts:["morning","reflection","rest"]},
] as const;
export const musicCategories = [
  {id:"classical",label:"잔잔한 클래식",query:"잔잔한 클래식 피아노 instrumental",vocals:false,contexts:["focus","reading","rest","bedtime"]},
  {id:"piano",label:"솔로 피아노",query:"독서 휴식 잔잔한 솔로 피아노 instrumental",vocals:false,contexts:["reading","rest","reflection","bedtime"]},
  {id:"pop",label:"잔잔한 팝송",query:"아침 휴식 잔잔한 팝송 acoustic pop",vocals:true,contexts:["morning","rest","walking"]},
  {id:"jazz",label:"잔잔한 재즈",query:"휴식 잔잔한 재즈 instrumental",vocals:false,contexts:["rest","reflection","reading"]},
  {id:"lofi",label:"가사 없는 로파이",query:"공부 코딩 가사 없는 lofi instrumental",vocals:false,contexts:["focus"]},
  {id:"ambient",label:"앰비언트",query:"명상 휴식 ambient instrumental",vocals:false,contexts:["meditation","rest","bedtime"]},
  {id:"nature",label:"자연 소리",query:"휴식 명상 물소리 새소리 자연 소리",vocals:false,contexts:["meditation","rest"]},
  {id:"acoustic",label:"어쿠스틱 팝",query:"산책 아침 acoustic pop playlist",vocals:true,contexts:["morning","walking","rest"]},
  {id:"upbeat",label:"경쾌한 팝·펑크",query:"실내 운동 upbeat pop funk playlist",vocals:true,contexts:["exercise","organize"]},
  {id:"bossa",label:"보사노바",query:"집안일 밝은 보사노바 instrumental",vocals:false,contexts:["organize","morning"]},
] as const;
export const contextLabels={reading:"독서",focus:"공부·과제",rest:"일정 사이 휴식",morning:"하루 시작",reflection:"생각 정리·회고",bedtime:"취침 준비",meditation:"명상·호흡",walking:"산책",exercise:"실내 운동",organize:"정리·집안일",relationships:"관계 돌아보기"} as const;
export type MediaContext=keyof typeof contextLabels;
export type MediaKind="book"|"music";
export type BookCategory=typeof bookCategories[number]["id"];
export type MusicCategory=typeof musicCategories[number]["id"];
const bookId=z.enum(["poetry","fiction","essay","logic","healing","relationships","happiness"]);
const musicId=z.enum(["classical","piano","pop","jazz","lofi","ambient","nature","acoustic","upbeat","bossa"]);
export function safeAladinUrl(value:string){try{const u=new URL(value);return u.protocol==="https:"&&["www.aladin.co.kr","aladin.co.kr","www1.aladin.co.kr"].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
const aladinUrl=z.string().max(500).refine(v=>v===""||safeAladinUrl(v),"알라딘의 https 주소를 입력해주세요.");
export const readingBookSchema=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(120),author:z.string().trim().max(100),category:bookId,url:aladinUrl,status:z.enum(["reading","finished","paused"]),updatedAt:z.string().datetime()}).strict();
const reaction=z.object({kind:z.enum(["book","music"]),key:z.string().max(30),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),opened:z.boolean().default(false),rating:z.enum(["like","dislike"]).optional()}).strict().refine(v=>(v.kind==="book"?bookCategories:musicCategories).some(c=>c.id===v.key),"올바른 추천 분야를 선택해주세요.");
export const mediaProfileSchema=z.object({
  books:z.array(bookId).max(7).default([]),music:z.array(musicId).max(10).default([]),
  novel:z.enum(["korean","english","japanese"]).default("korean"),vocals:z.enum(["any","instrumental","vocal"]).default("any"),
  reading:z.array(readingBookSchema).max(30).default([]),reactions:z.array(reaction).max(200).default([]),
}).strict().superRefine((v,ctx)=>{for(const key of ["books","music","reading","reactions"] as const){const ids=v[key].map(x=>typeof x==="string"?x:"id" in x?x.id:`${x.date}:${x.kind}:${x.key}`);if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",path:[key],message:"중복된 기록을 확인해주세요."});}});
export type MediaProfile=z.infer<typeof mediaProfileSchema>;
export const emptyMediaProfile=():MediaProfile=>mediaProfileSchema.parse({});
export function bookCid(key:BookCategory,novel:MediaProfile["novel"]="korean"){return key==="fiction"?{korean:50917,english:50919,japanese:50918}[novel]:bookCategories.find(c=>c.id===key)!.cid;}
export function bookListUrl(key:BookCategory,novel:MediaProfile["novel"]="korean"){return `https://www.aladin.co.kr/shop/common/wbest.aspx?BestType=Bestseller&BranchType=1&CID=${bookCid(key,novel)}`;}
export function musicQuery(key:MusicCategory,context:MediaContext="rest"){
  const genres:Record<MusicCategory,string>={classical:"잔잔한 클래식 instrumental",piano:"잔잔한 솔로 피아노 instrumental",pop:"잔잔한 팝송",jazz:"잔잔한 재즈 instrumental",lofi:"가사 없는 lofi instrumental",ambient:"ambient instrumental",nature:"물소리 새소리 자연 소리",acoustic:"acoustic pop playlist",upbeat:"upbeat pop funk playlist",bossa:"밝은 보사노바 instrumental"};
  const activity:Record<MediaContext,string>={reading:"독서",focus:"공부 코딩",rest:"편안한 휴식",morning:"아침 하루 시작",reflection:"생각 정리 회고",bedtime:"취침 준비",meditation:"명상 호흡",walking:"산책",exercise:"실내 운동",organize:"집안일 정리",relationships:"차분한 휴식"};
  return `${activity[context]} ${genres[key]}`;
}
export function musicSearchUrl(key:MusicCategory,context:MediaContext="rest"){return `https://www.youtube.com/results?search_query=${encodeURIComponent(musicQuery(key,context))}`;}
export function mediaContext(r:{id:string;when?:string;category?:string;activity?:{domain:string;id:string}}):MediaContext{
  if(/healing/.test(r.id))return "rest";
  if(/relationship/.test(r.id))return "relationships";if(/logic|focus/.test(r.id)||r.activity?.domain==="study"||r.activity?.domain==="career")return "focus";
  if(/sleep-music|reading-essay/.test(r.id)||r.when?.includes("취침"))return "bedtime";
  if(/read/.test(r.id)||r.activity?.domain==="reading")return "reading";
  if(/meditat|breath|mind-pause/.test(r.id))return "meditation";
  if(r.activity?.domain==="exercise")return r.activity.id==="walk"?"walking":"exercise";
  if(/desk|bag|inbox/.test(r.id)||r.activity?.domain==="organize")return "organize";
  if(/priority/.test(r.id))return "morning";if(/reflect|thanks|tomorrow|good/.test(r.id))return "reflection";
  return "rest";
}
export function mediaKinds(r:{id:string;source?:string;guidance?:{kind:string};activity?:{domain:string;id:string}}):MediaKind[]{
  if(r.source==="custom")return [];
  if(/read|logic|relationship/.test(r.id)||r.activity?.domain==="reading"||r.guidance?.kind==="reading")return ["book","music"];
  if(/music|rest|pause|focus|reflect|thanks|priority|desk|inbox|tomorrow/.test(r.id)||r.guidance?.kind==="music"||["study","career","exercise","rest","organize"].includes(r.activity?.domain??""))return ["music","book"];
  return [];
}
export function recordMediaReaction(profile:MediaProfile,kind:MediaKind,key:string,date:string,value:"open"|"like"|"dislike"){
  const previous=profile.reactions.find(r=>r.kind===kind&&r.key===key&&r.date===date);
  const next={kind,key,date,opened:value==="open"||!!previous?.opened,rating:value==="open"?previous?.rating:previous?.rating===value?undefined:value};
  return mediaProfileSchema.parse({...profile,reactions:[...profile.reactions.filter(r=>!(r.kind===kind&&r.key===key&&r.date===date)),next].filter(r=>r.date>=new Date(Date.parse(date)+-89*86400000).toISOString().slice(0,10)).slice(-200)});
}
export function rankMediaCategories(kind:MediaKind,context:MediaContext,profile:MediaProfile,date:string){
  const categories=kind==="book"?bookCategories:musicCategories,preferred=kind==="book"?profile.books:profile.music;
  return categories.filter(c=>kind==="book"||profile.vocals==="any"||("vocals" in c&&c.vocals===(profile.vocals==="vocal"))).map(c=>{
    const rows=profile.reactions.filter(r=>r.kind===kind&&r.key===c.id&&r.date<=date),likes=rows.filter(r=>r.rating==="like").length,dislikes=rows.filter(r=>r.rating==="dislike").length,opens=rows.filter(r=>r.opened).length;
    const fit=(c.contexts as readonly string[]).includes(context)?1:.25,taste=preferred.includes(c.id as never)?1:preferred.length?.3:.5,feedback=(1+likes+.1*opens)/(2+likes+dislikes+.1*opens),novelty=1/(1+rows.filter(r=>r.date===date).length);
    return {key:c.id,label:c.label,score:.4*fit+.3*taste+.2*feedback+.1*novelty,fit,preferred:preferred.includes(c.id as never),reason:`${contextLabels[context]} 활동${preferred.includes(c.id as never)?"과 저장한 취향":"에 맞는 선택지"}를 참고했어요.`};
  }).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
}
export type MediaItem={id:string;title:string;creator:string;url:string;image?:string;rank?:number;seconds?:number};
export type MediaCatalog={mode:"links"|"live"|"unavailable";kind:MediaKind;key:string;items:MediaItem[];sourceUrl:string;checkedAt?:string;message?:string};
