import { supplementSourceUrl } from "./supplement-source-url";

export class SupplementPageError extends Error{constructor(public code:string,message:string,public status=422){super(message);}}
const entities:Record<string,string>={nbsp:" ",amp:"&",lt:"<",gt:">",quot:'"',apos:"'",micro:"μ",mu:"μ"};
function decode(value:string){return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key:string)=>{
  if(key[0]!=="#")return entities[key.toLowerCase()]??all;
  const n=key[1].toLowerCase()==="x"?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):" ";
});}
export async function fetchSupplementPage(value:string,fetcher:typeof fetch=fetch){
  const initial=supplementSourceUrl(value);if(!initial)throw new SupplementPageError("UNSUPPORTED_URL","iHerb 또는 지원하는 제조사의 상품 상세 링크를 입력해 주세요.",400);
  let url:string=initial;
  const signal=AbortSignal.timeout(10000);
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetcher(url,{redirect:"manual",cache:"no-store",signal,headers:{Accept:"text/html, text/plain"}});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");const next=location?supplementSourceUrl(new URL(location,url).href):null;
      if(!next||redirects===3)throw new SupplementPageError("UNSAFE_REDIRECT","이 상품 페이지의 이동 주소를 확인할 수 없어요.");url=next;continue;
    }
    if(!response.ok)throw new SupplementPageError("SOURCE_BLOCKED","상품 페이지를 읽을 수 없어요. NIH 후보를 선택하거나 제조사 상품 링크로 다시 조회해 주세요.");
    if(!/text\/(html|plain)/i.test(response.headers.get("content-type")??""))throw new SupplementPageError("NO_TEXT_LABEL","텍스트 성분표가 있는 상품 페이지가 필요해요.");
    if(Number(response.headers.get("content-length"))>800000)throw new SupplementPageError("SOURCE_TOO_LARGE","상품 페이지가 너무 커서 분석하지 못했어요.");
    const reader=response.body?.getReader();if(!reader)throw new SupplementPageError("NO_TEXT_LABEL","상품 페이지 본문이 비어 있어요.");
    let size=0,html="";const decoder=new TextDecoder();
    try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>800000)throw new SupplementPageError("SOURCE_TOO_LARGE","상품 페이지가 너무 커서 분석하지 못했어요.");html+=decoder.decode(part.value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel();}
    const title=decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??"상품 성분표").replace(/<[^>]*>/g," ").trim().slice(0,200);
    const text=decode(html.replace(/<!--[\s\S]*?-->/g," ").replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
      .replace(/<\/(?:tr|p|div|h[1-6]|li)>|<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g," ")).replace(/[\t ]+/g," ").replace(/\n\s*\n/g,"\n").trim();
    const start=text.search(/supplement facts|nutrition facts|serving size|영양[· ]?성분|1회 제공량/i);
    if(start<0)throw new SupplementPageError("NO_TEXT_LABEL","페이지에서 텍스트 성분표를 찾지 못했어요. 성분표가 공개된 제조사 상품 링크로 다시 조회해 주세요.");
    return {url,title,text:title+"\n"+text.slice(0,2000)+"\n"+text.slice(Math.max(0,start-500),start+35000)};
  }
  throw new SupplementPageError("SOURCE_BLOCKED","상품 페이지를 읽을 수 없어요.");
}
