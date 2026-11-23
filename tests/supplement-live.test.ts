import test from "node:test";
import assert from "node:assert/strict";
import { lookupLiveSupplement,validateLiveLabel,LiveSearchError,LIVE_SUPPLEMENT_MODEL,type ExtractedLabel } from "../lib/supplement-live-search";
import { createSupplementSearchHandler } from "../lib/supplement-search-api";
import { applySupplementCommand,emptySupplementJournal,supplementProductSchema } from "../lib/supplement-journal";
import { defaultAnswers,defaultSchedule,type AppState } from "../lib/model";
import { servingCount } from "../lib/supplement-intake";
import { createDsldLookup } from "../lib/supplement-dsld";

const now=new Date("2026-11-23T10:00:00+09:00");
const sources=[{title:"Manufacturer label",url:"https://example.com/label"}];
const report="Exact brand product. Serving Size: 2 capsules\nVitamin C 1,000 mg\nVitamin D3 1,000 IU\nMagnesium 0.1 g\nZinc 0 mg";
const payload=():ExtractedLabel=>({status:"exact",name:"Exact brand product",servingSize:2,servingUnit:"캡슐",servingEvidence:"Serving Size: 2 capsules",partial:false,
  facts:[{name:"Vitamin C",amount:1000,unit:"mg",evidence:"Vitamin C 1,000 mg",sourceIndex:0},
    {name:"Vitamin D3",amount:1000,unit:"IU",evidence:"Vitamin D3 1,000 IU",sourceIndex:0},
    {name:"Magnesium",amount:.1,unit:"g",evidence:"Magnesium 0.1 g",sourceIndex:0},
    {name:"Zinc",amount:0,unit:"mg",evidence:"Zinc 0 mg",sourceIndex:0}]});
function first(){return {candidates:[{finishReason:"STOP",content:{parts:[{text:report}]},groundingMetadata:{webSearchQueries:["exact label"],groundingChunks:[{web:{uri:sources[0].url,title:sources[0].title}}],groundingSupports:[{groundingChunkIndices:[0]}]}}]};}
const second=(data:unknown=payload())=>({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(data)}]}}]});
const query={name:"Exact brand product"};

test("검색과 정형 추출은 별도 요청이며 재조회마다 실시간으로 가져오고 DB 쓰기가 없다",async()=>{
  const calls:{url:string;body:Record<string,unknown>}[]=[];
  const fetcher=(async(url,options)=>{const body=JSON.parse(String(options?.body));calls.push({url:String(url),body});assert.equal(options?.cache,"no-store");return Response.json(calls.length%2?first():second());}) as typeof fetch;
  const one=await lookupLiveSupplement(query,"test-key",fetcher,now),two=await lookupLiveSupplement(query,"test-key",fetcher,now);
  assert.equal(calls.length,4);assert.ok(calls.every(c=>c.url.includes(LIVE_SUPPLEMENT_MODEL)));
  assert.ok(calls[0].body.tools);assert.equal((calls[0].body.generationConfig as Record<string,unknown>).responseSchema,undefined);
  assert.equal(calls[1].body.tools,undefined);assert.ok((calls[1].body.generationConfig as Record<string,unknown>).responseSchema);
  assert.deepEqual(one.product,two.product);assert.equal(one.product?.label.retrievedAt,now.toISOString());
  assert.deepEqual(one.product?.label.facts.map(f=>[f.name,f.amount,f.unit]),[["비타민 C",1000,"mg"],["비타민 D3",25,"μg"],["마그네슘",100,"mg"],["아연",0,"mg"]]);
  assert.equal(one.product?.label.facts[1].rawAmount,1000);assert.equal(one.product?.label.facts[1].rawUnit,"IU");
});

test("미확인 함량은 0으로 만들지 않으며 원문 없는 수치·단위·출처와 다른 제공량을 거절한다",()=>{
  const p=payload();p.facts.push({name:"Unknown",amount:null,unit:"mg",evidence:"",sourceIndex:0});
  const product=validateLiveLabel(p,report,sources,query,now)!;assert.equal(product.label.partial,true);assert.equal(product.label.facts.length,4);
  for(const change of [{amount:1001},{evidence:"Vitamin C 999 mg"},{unit:"g"},{sourceIndex:4}]){
    const p=payload();p.facts=[{...p.facts[0],...change}];assert.equal(validateLiveLabel(p,report,sources,query,now),null);
  }
  for(const change of [{servingSize:1},{servingUnit:"mL"},{status:"ambiguous"},{status:"unavailable"}])assert.equal(validateLiveLabel({...payload(),...change},report,sources,query,now),null);
});

test("무료 모델의 한도·권한·지원 오류에서 유료 모델이나 다른 모델로 재시도하지 않는다",async()=>{
  for(const [status,code] of [[429,"QUOTA_EXHAUSTED"],[404,"MODEL_UNAVAILABLE"],[403,"KEY_PERMISSION"]] as const){
    let calls=0;await assert.rejects(()=>lookupLiveSupplement(query,"test-key",(async()=>{calls++;return Response.json({}, {status});}) as typeof fetch),e=>e instanceof LiveSearchError&&e.code===code);
    assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(()=>lookupLiveSupplement(query,"",(async()=>{calls++;return Response.json({});}) as typeof fetch));assert.equal(calls,0);
});

test("검색 출처나 완료 응답이 없으면 성분표를 확정하지 않는다",async()=>{
  let calls=0;const missing=first();missing.candidates[0].groundingMetadata.groundingSupports=[];
  const result=await lookupLiveSupplement(query,"test-key",(async()=>{calls++;return Response.json(missing);}) as typeof fetch);
  assert.equal(result.product,null);assert.equal(calls,1);
  calls=0;const truncated=second();truncated.candidates[0].finishReason="MAX_TOKENS";
  const result2=await lookupLiveSupplement(query,"test-key",(async()=>Response.json(++calls===1?first():truncated)) as typeof fetch);
  assert.equal(result2.product,null);
});

const request=(body:unknown,origin="https://test.example")=>new Request("https://test.example/api/supplement-web-search",{method:"POST",headers:{origin},body:JSON.stringify(body)});
test("실시간 조회 API는 인증·출처·상품 URL과 호출 제한을 확인하고 결과만 반환한다",async()=>{
  let owner:string|null=null,calls=0,clock=0;
  const handler=createSupplementSearchHandler(async()=>owner,async()=>{calls++;return {product:null};},()=>clock);
  assert.equal((await handler(request(query))).status,401);owner="owner";
  assert.equal((await handler(request(query,"https://evil.example"))).status,403);
  assert.equal((await handler(request({name:"",url:"https://127.0.0.1/private"}))).status,400);
  assert.equal(calls,0);
  for(let i=0;i<4;i++)assert.equal((await handler(request(query))).status,200);
  assert.equal((await handler(request(query))).status,429);clock=60001;
  assert.equal((await handler(request({url:"https://kr.iherb.com/pr/example/1234"}))).status,200);
});

test("제품 등록 명령 전에는 목록이 비어 있고 등록 이후 조회일·출처·성분표가 복용 이력에 고정된다",()=>{
  const product=validateLiveLabel(payload(),report,sources,query,now)!;
  const app:AppState={version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:defaultAnswers,schedule:defaultSchedule,inbody:[],days:[]};
  let journal=emptySupplementJournal();assert.equal(journal.products.length,0);
  const saved=supplementProductSchema.parse({id:"live",name:product.name,label:product.label,dose:"1",url:"",startDate:"2026-11-23",weekdays:[1],slots:[{id:"morning",anchor:"fixed",time:"09:00",offset:0}]});
  journal=applySupplementCommand(journal,{action:"save",product:saved},app,now);
  assert.equal(journal.products[0].label?.retrievedAt,now.toISOString());assert.equal(servingCount("1",journal.products[0].label!),.5);
  journal=applySupplementCommand(journal,{action:"record",productId:"live",date:"2026-11-23",slotId:"morning",status:"taken"},app,now);
  const snapshot=structuredClone(journal.records[0].snapshot);
  journal=applySupplementCommand(journal,{action:"save",product:{...saved,label:{...product.label,retrievedAt:new Date(now.getTime()+60000).toISOString(),facts:[{name:"비타민 C",unit:"mg",amount:500,dailyValuePercent:null}]}}},app,now);
  assert.deepEqual(journal.records[0].snapshot,snapshot);assert.equal(journal.records[0].snapshot.label?.facts[0].amount,1000);
});

test("NIH는 브랜드를 포함한 제품명을 판매 중 검색으로 실시간 조회하며 식물성 캡슐 단위를 인식한다",async()=>{
  let calls=0;
  const raw={id:242474,brandName:"Solgar",fullName:"Ester-C Plus 500 mg Vitamin C",upcSku:"123456789012",offMarket:0,servingsPerContainer:"100",netContents:[{display:"100 Vegetable Capsules"}],
    servingSizes:[{order:1,minQuantity:1,maxQuantity:1,unit:"Vegetable Capsule(s)",inSFB:true}],
    ingredientRows:[{name:"Vitamin C",nestedRows:[],quantity:[{servingSizeOrder:1,operator:"=",quantity:500,unit:"mg",dailyValueTargetGroup:[{percent:556}]}]}]};
  const lookup=createDsldLookup((async(url,options)=>{
    calls++;assert.equal(options?.cache,"no-store");
    const u=new URL(String(url));
    if(u.pathname.endsWith("search-filter")){assert.equal(u.searchParams.get("status"),"1");assert.equal(u.searchParams.get("q"),"Solgar Vitamin C");return Response.json({hits:[{_id:"242474"}]});}
    return Response.json(raw);
  }) as typeof fetch);
  const p=await lookup.byName("Solgar Vitamin C");assert.equal(p.length,1);assert.equal(p[0].label.servingUnit,"캡슐");assert.equal(p[0].label.facts[0].amount,500);
  assert.ok(p[0].label.retrievedAt);assert.equal(p[0].label.query,"Solgar Vitamin C");
  await lookup.byName("Solgar Vitamin C");assert.equal(calls,4);
});

test("NIH의 다른 브랜드·품절 라벨·일치하지 않는 바코드는 제품으로 반영하지 않는다",async()=>{
  const lookup=createDsldLookup((async()=>Response.json({hits:[],stats:{count:0}})) as typeof fetch);
  assert.equal(await lookup.byBarcode("123456789012"),null);
  assert.deepEqual(await lookup.byName("Missing brand"),[]);
});
