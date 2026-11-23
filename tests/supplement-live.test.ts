import test from "node:test";
import assert from "node:assert/strict";
import { lookupLiveSupplement,validateLiveLabel,LiveSearchError,LIVE_SUPPLEMENT_MODEL,type ExtractedLabel } from "../lib/supplement-live-search";
import { createSupplementSearchHandler } from "../lib/supplement-search-api";
import { applySupplementCommand,emptySupplementJournal,supplementProductSchema } from "../lib/supplement-journal";
import { defaultAnswers,defaultSchedule,type AppState } from "../lib/model";
import { servingCount,supplementIntake } from "../lib/supplement-intake";
import { createDsldLookup } from "../lib/supplement-dsld";
import { fetchSupplementPage } from "../lib/supplement-page";
import { supplementSourceUrl } from "../lib/supplement-source-url";
import { supplementNihQuery,iherbEnglishName } from "../lib/supplement-query";

const now=new Date("2026-11-23T10:00:00+09:00");
const sources=[{title:"Manufacturer label",url:"https://example.com/label"}];
const report="Exact brand product. Serving Size: 2 capsules\nVitamin C 1,000 mg\nVitamin D3 1,000 IU\nMagnesium 0.1 g\nZinc 0 mg";
const payload=():ExtractedLabel=>({status:"exact",name:"Exact brand product",servingSize:2,servingUnit:"캡슐",servingEvidence:"Serving Size: 2 capsules",partial:false,
  facts:[{name:"Vitamin C",amount:1000,unit:"mg",evidence:"Vitamin C 1,000 mg",sourceIndex:0},
    {name:"Vitamin D3",amount:1000,unit:"IU",evidence:"Vitamin D3 1,000 IU",sourceIndex:0},
    {name:"Magnesium",amount:.1,unit:"g",evidence:"Magnesium 0.1 g",sourceIndex:0},
    {name:"Zinc",amount:0,unit:"mg",evidence:"Zinc 0 mg",sourceIndex:0}]});
const second=(data:unknown=payload())=>({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(data)}]}}]});
const query={name:"Exact brand product",url:"https://www.solgar.com/products/exact-brand-product"};
const page=()=>new Response("<title>Exact brand product</title><div>"+report.replaceAll("\n","<br>")+"</div>",{headers:{"content-type":"text/html"}});

test("iHerb 링크가 있어도 무료 NIH 후보 조회용 영문 검색어를 만들며 동일 제품으로 자동 확정하지 않는다",()=>{
  const name="California Gold Nutrition (캘리포니아골드뉴트리션), 루테인, 금잔화 추출물 유래 제아잔틴 함유, 베지 소프트젤 60정";
  assert.equal(supplementNihQuery(name,"https://kr.iherb.com/pr/california-gold-nutrition-lutein-with-zeaxanthin-from-marigold-extract-60-veggie-softgels/95888"),"california gold nutrition lutein");
  assert.equal(supplementNihQuery("한국어 제품명","https://kr.iherb.com/pr/life-extension-two-per-day-multivitamin-120-tablets/137715"),"life extension two per day multivitamin");
  assert.equal(supplementNihQuery("Solgar Vitamin C",""),"Solgar Vitamin C");
  assert.equal(supplementNihQuery("정확한 제품명","https://example.com/pr/other-product/95888"),"정확한 제품명");
});

test("실제 페이지 원문을 매번 읽고 도구 없는 단일 Gemini 요청만 보내며 출처와 수치를 보존한다",async()=>{
  const calls:{url:string;body?:Record<string,unknown>}[]=[];
  const fetcher=(async(url,options)=>{const body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({url:String(url),body});assert.equal(options?.cache,"no-store");return body?Response.json(second()):page();}) as typeof fetch;
  const one=await lookupLiveSupplement(query,"test-key",fetcher,now),two=await lookupLiveSupplement(query,"test-key",fetcher,now);
  assert.equal(calls.length,4);assert.equal(calls[0].url,query.url);
  const requests=calls.filter(c=>c.body);assert.equal(requests.length,2);
  assert.ok(requests.every(c=>c.url.includes(LIVE_SUPPLEMENT_MODEL)&&c.body?.tools===undefined));
  assert.ok((requests[0].body?.generationConfig as Record<string,unknown>).responseSchema);
  assert.ok(JSON.stringify(requests[0].body).includes("Vitamin C 1,000 mg"));
  assert.deepEqual(one.product,two.product);assert.equal(one.product?.label.retrievedAt,now.toISOString());
  assert.equal(one.product?.label.webSources?.[0].url,query.url);
  assert.deepEqual(one.product?.label.facts.map(f=>[f.name,f.amount,f.unit]),[["비타민 C",1000,"mg"],["비타민 D3",25,"μg"],["마그네슘",100,"mg"],["아연",0,"mg"]]);
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
    let calls=0;await assert.rejects(()=>lookupLiveSupplement(query,"test-key",(async(_url,options)=>{if(!options?.body)return page();calls++;return Response.json({}, {status});}) as typeof fetch),e=>e instanceof LiveSearchError&&e.code===code);
    assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(()=>lookupLiveSupplement(query,"",(async()=>{calls++;return Response.json({});}) as typeof fetch));assert.equal(calls,0);
});

test("차단·이미지 전용 페이지와 지원하지 않는 주소는 Gemini 호출 없이 중단한다",async()=>{
  for(const source of [new Response("blocked",{status:403}),new Response("<p>Image label only</p>",{headers:{"content-type":"text/html"}})]){
    let modelCalls=0;await assert.rejects(()=>lookupLiveSupplement(query,"test-key",(async(_url,options)=>{if(options?.body)modelCalls++;return source;}) as typeof fetch),e=>e instanceof LiveSearchError&&["SOURCE_BLOCKED","NO_TEXT_LABEL"].includes(e.code));assert.equal(modelCalls,0);
  }
  await assert.rejects(()=>lookupLiveSupplement({name:query.name},"test-key"),e=>e instanceof LiveSearchError&&e.code==="NEED_PRODUCT_URL");
  for(const url of ["https://127.0.0.1/private","https://www.solgar.com.evil.example/label","http://www.solgar.com/label","https://user:password@www.solgar.com/label"]){assert.equal(supplementSourceUrl(url),null);}
  await assert.rejects(()=>fetchSupplementPage(query.url,(async()=>new Response(null,{status:302,headers:{location:"https://127.0.0.1/private"}})) as typeof fetch));
  await assert.rejects(()=>fetchSupplementPage(query.url,(async()=>new Response("x",{headers:{"content-type":"text/html","content-length":"800001"}})) as typeof fetch));
});
test("잘린 모델 응답이나 원문과 다른 성분 이름은 확정하지 않는다",async()=>{
  const truncated=second();truncated.candidates[0].finishReason="MAX_TOKENS";
  const result=await lookupLiveSupplement(query,"test-key",(async(_url,options)=>options?.body?Response.json(truncated):page()) as typeof fetch);
  assert.equal(result.product,null);
  const p=payload();p.facts=[{...p.facts[0],name:"Iron"}];assert.equal(validateLiveLabel(p,report,sources,query,now),null);
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
  const partial=structuredClone(journal);partial.products[0].label!.partial=true;const row=supplementIntake(partial,app,"2026-11-23","plan").rows[0];assert.equal(row.missing,true);assert.equal(row.doseUnknown,false);assert.equal(row.amounts["비타민 C|mg"],500);
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

const wheyName="California Gold Nutrition, Sport, Whey Protein Isolate, Dark Chocolate , 2 lb (907 g)";
const wheyUrl="https://www.iherb.com/pr/california-gold-nutrition-sport-whey-protein-isolate-dark-chocolate-2-lb-907-g/82696";
test("한국어 iHerb 붙여넣기는 영문 링크 이름을 사용하고 포장 무게는 맛·제형 검색 조건과 분리한다",()=>{
  const english=iherbEnglishName("# 캘리포니아 골드 뉴트리션, 다크 초콜릿 단백질 907g",wheyUrl);
  assert.equal(english,"California Gold Nutrition Sport Whey Protein Isolate Dark Chocolate 2 Lb 907 G");
  assert.equal(iherbEnglishName("한국어 제품명",""),"한국어 제품명");
  assert.equal(iherbEnglishName("# Solgar Vitamin C\n", ""),"Solgar Vitamin C");
  assert.equal(supplementNihQuery(wheyName,wheyUrl),"california gold nutrition sport whey protein isolate dark chocolate");
  assert.equal(supplementNihQuery(wheyName,""),"California Gold Nutrition, Sport, Whey Protein Isolate, Dark Chocolate");
  assert.equal(supplementNihQuery("Solgar Vitamin C 1000 mg",""),"Solgar Vitamin C 1000 mg");
});
test("NIH 분말의 Gram(s)·Calorie(s)와 하위 영양성분을 보존하고 명시된 1스쿱 단위로 제공한다",async()=>{
  const row=(name:string,amount:number,unit:string,nestedRows:unknown[]=[])=>({name,nestedRows,quantity:[{servingSizeOrder:1,operator:"=",quantity:amount,unit,dailyValueTargetGroup:[]}]});
  const raw={id:275357,brandName:"California Gold Nutrition SPORT",fullName:"Whey Protein Isolate Dark Chocolate",upcSku:"898220012022",offMarket:0,servingsPerContainer:"23",netContents:[{display:"2 lb(s)"},{display:"907 Gram(s)"}],servingSizes:[{order:1,minQuantity:40,maxQuantity:40,unit:"Gram(s)",notes:"1 Scoop",inSFB:true}],ingredientRows:[row("Calories",150,"Calorie(s)"),row("Protein",27,"Gram(s)"),row("Total Sugars",6,"Gram(s)",[row("Added Sugars",6,"Gram(s)")]),row("Vitamin D",0,"mcg")]};
  const lookup=createDsldLookup((async url=>String(url).includes("search-filter")?Response.json({hits:[{_id:"275357"}]}):Response.json(raw)) as typeof fetch);
  const products=await lookup.byName(wheyName);assert.equal(products.length,1);
  const label=products[0].label;assert.equal(label.servingSize,1);assert.equal(label.servingUnit,"스쿱");assert.equal(label.partial,false);
  assert.deepEqual(label.facts.map(f=>[f.name,f.amount,f.unit]),[["Calories",150,"kcal"],["Protein",27,"g"],["Total Sugars",6,"g"],["Added Sugars",6,"g"],["비타민 D",0,"μg"]]);
  raw.fullName="Whey Protein Isolate Vanilla";assert.equal((await lookup.byName(wheyName)).length,0);
});
