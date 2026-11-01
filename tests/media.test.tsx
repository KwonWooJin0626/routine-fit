import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { bookCid,bookListUrl,contentInterests,emptyMediaProfile,mediaContext,mediaKinds,mediaProfileSchema,musicSearchUrl,rankMediaCategories,readingBookSchema,recordMediaReaction } from "../lib/media";
import { ContentInterestChoices } from "../components/content-interests";
import { createMediaCatalogProvider,parseYouTubeItems } from "../lib/media-providers";
import { stateSchema,defaultAnswers,defaultSchedule } from "../lib/model";
import { MediaProvider,MediaSettings,RoutineMedia } from "../components/media-recommendations";
import { RoutineSources } from "../components/evidence-sources";
import { growthCatalog } from "../lib/growth-routines";

test("공식 카테고리와 소설 하위분야를 정확히 연결하고 검색어는 URL 인코딩한다",()=>{
  assert.equal(bookCid("fiction","english"),50919);assert.equal(bookCid("poetry"),50940);assert.equal(bookCid("logic"),51412);
  const u=new URL(bookListUrl("fiction","japanese"));assert.equal(u.searchParams.get("CID"),"50918");assert.equal(u.searchParams.get("BestType"),"Bestseller");
  assert.match(new URL(musicSearchUrl("lofi")).searchParams.get("search_query")!,/가사 없는/);
});
test("활동 문맥과 보컬 선호를 반영하고 음악 반응이 책 추천에 섞이지 않는다",()=>{
  const p=emptyMediaProfile();assert.equal(mediaContext({id:"growth-reading-logic"}),"focus");assert.equal(mediaContext({id:"growth-reading-relationships"}),"relationships");assert.equal(mediaContext({id:"sleep-music"}),"bedtime");
  assert.equal(rankMediaCategories("book","relationships",p,"2026-11-01")[0].key,"relationships");
  const instrumental=rankMediaCategories("music","exercise",{...p,vocals:"instrumental"},"2026-11-01");assert.ok(!instrumental.some(r=>r.key==="upbeat"||r.key==="pop"));
  const after=recordMediaReaction(p,"music","jazz","2026-11-01","like");assert.deepEqual(rankMediaCategories("book","rest",p,"2026-11-01"),rankMediaCategories("book","rest",after,"2026-11-01"));
  assert.deepEqual(mediaKinds({id:"custom-reading",source:"custom"}),[]);
});

test("기존 취향은 관심사 없이 복원되고 모든 관심사를 중복 없이 선택할 수 있다",()=>{
  const legacy=mediaProfileSchema.parse({books:["poetry"],music:["jazz"],reading:[],reactions:[]});assert.deepEqual(legacy.interests,[]);assert.deepEqual(legacy.books,["poetry"]);
  const all=contentInterests.map(i=>i.id);assert.deepEqual(mediaProfileSchema.parse({...legacy,interests:all}).interests,all);
  for(const interests of [["relationships","relationships"],["unknown"]])assert.equal(mediaProfileSchema.safeParse({...legacy,interests}).success,false);
});

test("현재 관심사는 책과 음악 후보에 반영되고 지우면 기존 추천으로 돌아온다",()=>{
  const base=emptyMediaProfile(),date="2026-11-01",profile={...base,interests:["relationships","happiness"] as const};
  for(const [kind,key] of [["book","relationships"],["music","pop"]] as const){
    const before=rankMediaCategories(kind,"rest",base,date),after=rankMediaCategories(kind,"rest",{...profile,interests:[...profile.interests]},date);
    assert.ok(after.find(r=>r.key===key)!.score>before.find(r=>r.key===key)!.score);assert.equal(after.find(r=>r.key===key)!.interestFit,1);assert.match(after.find(r=>r.key===key)!.reason,/관심사/);
    assert.deepEqual(rankMediaCategories(kind,"rest",{...profile,interests:[]},date),before);
  }
  const instrumental=rankMediaCategories("music","rest",{...base,interests:["happiness"],vocals:"instrumental"},date);assert.ok(!instrumental.some(r=>r.key==="pop"));
  const books=rankMediaCategories("book","rest",{...base,interests:["relationships","happiness","health"]},date).slice(0,3).map(r=>r.key);assert.ok(books.includes("relationships"));assert.ok(books.includes("happiness"));assert.ok(books.includes("healing"));
  const state=stateSchema.parse({version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 관심사"},schedule:defaultSchedule,inbody:[],days:[],media:{...profile,interests:[...profile.interests]}});assert.deepEqual(state.days,[]);assert.deepEqual(state.media?.interests,["relationships","happiness"]);
});

test("관심사 선택은 복수 선택 상태와 수정·비우기 기능을 제공한다",()=>{
  const html=renderToStaticMarkup(<ContentInterestChoices value={["relationships","health"]} onChange={()=>{}}/>);
  assert.equal((html.match(/aria-pressed="true"/g)??[]).length,2);assert.equal((html.match(/aria-pressed=/g)??[]).length,contentInterests.length);assert.match(html,/관심사 선택 지우기/);assert.match(html,/2개 선택/);
});
test("외부 링크 열기는 하루 한 번 관심으로만 기록하고 루틴 실행 기록을 만들지 않는다",()=>{
  const p=recordMediaReaction(emptyMediaProfile(),"book","essay","2026-11-01","open"),again=recordMediaReaction(p,"book","essay","2026-11-01","open");assert.deepEqual(p,again);assert.equal(p.reactions[0].opened,true);assert.equal("statuses" in p,false);
  const disliked=recordMediaReaction(p,"book","essay","2026-11-01","dislike"),undone=recordMediaReaction(disliked,"book","essay","2026-11-01","dislike");assert.equal(undone.reactions[0].rating,undefined);assert.equal(undone.reactions[0].opened,true);
  const old={...p,reactions:[{kind:"book" as const,key:"poetry",date:"2026-01-01",opened:true}]};assert.equal(recordMediaReaction(old,"book","essay","2026-11-01","open").reactions.length,1);
});
test("책·음악 취향과 읽는 책을 기존 계정 상태에 저장하며 외부·위험 링크와 중복을 거절한다",()=>{
  const reading={id:"book-one",title:"합성 검증 도서",author:"합성 저자",category:"essay",url:"https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123",status:"reading",updatedAt:"2026-11-01T00:00:00.000Z"};
  const p=mediaProfileSchema.parse({...emptyMediaProfile(),books:["essay","poetry"],music:["jazz"],reading:[reading]});
  const state=stateSchema.parse({version:1,consentAt:reading.updatedAt,consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 검증"},schedule:defaultSchedule,inbody:[],days:[],media:p});assert.deepEqual(state.media,p);
  for(const url of ["javascript:alert(1)","https://www.aladin.co.kr.evil.test/x","https://user:password@www.aladin.co.kr/","https://evil.test"]){assert.equal(readingBookSchema.safeParse({...reading,url}).success,false);}
  assert.equal(mediaProfileSchema.safeParse({...p,books:["essay","essay"]}).success,false);assert.equal(mediaProfileSchema.safeParse({...p,reading:[reading,reading]}).success,false);
});
test("키가 없으면 실제 후보와 순위를 꾸미지 않고 공식 링크만 반환한다",async()=>{
  const get=createMediaCatalogProvider({fetcher:async()=>{throw Error("must not fetch");}});for(const kind of ["book","music"] as const){const result=await get(kind,kind==="book"?"essay":"jazz");assert.equal(result.mode,"links");assert.deepEqual(result.items,[]);assert.ok(result.sourceUrl.startsWith("https:"));assert.equal(result.checkedAt,undefined);}
  await assert.rejects(()=>get("book","invented-category"));
});
test("유튜브의 공개·지역·라이브 조건과 실제 길이를 확인한다",()=>{
  const make=(id:string)=>({id,snippet:{title:"잔잔한 &amp; 음악",channelTitle:"합성 채널",liveBroadcastContent:"none"},contentDetails:{duration:"PT1H2M3S"},status:{privacyStatus:"public",uploadStatus:"processed"}});
  const a=make("abcdefghijk"),b=make("lmnopqrstuv"),c=make("12345678901");b.status.privacyStatus="private";c.snippet.liveBroadcastContent="live";
  const result=parseYouTubeItems({items:[c,b,a]},[a.id,b.id,c.id]);assert.equal(result.length,1);assert.equal(result[0].seconds,3723);assert.equal(result[0].title,"잔잔한 & 음악");assert.equal(result[0].url,`https://www.youtube.com/watch?v=${a.id}`);
});
test("선택한 분야만 조회하고 외부 실패 시 비밀 값을 노출하지 않는다",async()=>{
  const urls:string[]=[];const get=createMediaCatalogProvider({youtubeKey:"synthetic-secret",fetcher:async url=>{urls.push(url);return Response.json({items:[]},{headers:{date:"Sun, 01 Nov 2026 00:00:00 GMT"}});}});
  const book=await get("book","logic");assert.equal(book.mode,"links");assert.equal(urls.length,0);
  const result=await get("music","jazz","korean","rest");assert.equal(result.mode,"live");assert.equal(new URL(urls[0]).searchParams.get("type"),"video");assert.match(new URL(urls[0]).searchParams.get("q")!,/재즈/);assert.ok(!JSON.stringify(result).includes("synthetic-secret"));
  const failed=await createMediaCatalogProvider({youtubeKey:"secret",fetcher:async()=>{throw Error("secret");}})("music","jazz");assert.equal(failed.mode,"unavailable");assert.ok(!JSON.stringify(failed).includes("secret"));
});
test("설정과 루틴 진입점은 실제 후보를 조작하지 않고 빈 참고자료 행은 숨긴다",()=>{
  const reading=growthCatalog().find(r=>r.id==="growth-reading")!;
  const html=renderToStaticMarkup(<MediaProvider profile={emptyMediaProfile()} busy={false} demo onSave={async()=>{}}><MediaSettings/><RoutineMedia routine={reading}/></MediaProvider>);
  assert.ok(html.includes("책 추천 받기"));assert.ok(html.includes("음악 추천 받기"));assert.ok(html.includes("논리와 비판적 사고"));assert.ok(!html.includes("알라딘 1위"));
  assert.equal(renderToStaticMarkup(<RoutineSources routine={reading}/>),"");
});
