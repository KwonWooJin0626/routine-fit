import { z } from "zod";

export const supplementFactUnits=["g","mg","μg","μg RAE","μg DFE","mg NE","IU","CFU","kcal"] as const;
export const supplementServingUnits=["정","캡슐","스쿱","mL","g","포","방울","소프트젤"] as const;
const unit=z.enum(supplementFactUnits);
const fact=z.object({name:z.string().trim().min(1).max(120),amount:z.number().finite().nonnegative().max(1e15),unit,
  dailyValuePercent:z.number().finite().nonnegative().nullable(),
  rawAmount:z.number().finite().nonnegative().optional(),rawUnit:z.string().max(30).optional(),
  evidence:z.string().max(240).optional(),sourceIndex:z.number().int().min(0).max(4).optional(),manual:z.boolean().optional()});
export const supplementLabelSchema=z.object({
  retrievedAt:z.string().datetime().optional(),
  query:z.string().max(200).optional(),
  lookupUrl:z.string().url().max(1000).optional(),
  extractionVersion:z.literal("live-label-v1").optional(),
  productId:z.string().regex(/^\d+$/).optional(),
  productCode:z.string().max(60).optional(),
  upc:z.string().regex(/^(?:\d{8}|\d{12,14})$/).optional(),
  servingSize:z.number().min(0.000001).max(1000000),
  servingUnit:z.enum(supplementServingUnits),
  servingsPerContainer:z.number().positive().optional(),
  source:z.enum(["photo","dsld","web","manual"]).optional(),
  webSources:z.array(z.object({title:z.string().min(1).max(200),url:z.string().url().max(2000).refine(url=>url.startsWith("https://"))})).max(5).optional(),
  dsldId:z.number().int().positive().optional(),
  partial:z.boolean().optional(),
  facts:z.array(fact).min(1).max(80),
}).refine(label=>new Set(label.facts.map(row=>row.name+"|"+row.unit)).size===label.facts.length,
  {path:["facts"],message:"같은 이름과 단위의 성분이 중복됐어요."});
export type SupplementLabel=z.infer<typeof supplementLabelSchema>;

export function iherbProductId(value:string){
  try{
    const url=new URL(value.trim());
    if(url.protocol!=="https:"||!["iherb.com","www.iherb.com","kr.iherb.com"].includes(url.hostname)||url.port||url.username||url.password)return null;
    return url.pathname.match(/^\/pr\/[^/]+\/(\d+)\/?$/i)?.[1]??null;
  }catch{return null;}
}

// Label values for iHerb 137715, product LEX-01011.
const facts: [string,number,z.infer<typeof unit>,number|null][]=[
  ["비타민 A",1500,"μg RAE",167],["비타민 C",470,"mg",522],["비타민 D3",50,"μg",250],
  ["비타민 E",67,"mg",447],["티아민(B1)",75,"mg",6250],["리보플라빈(B2)",50,"mg",3846],
  ["나이아신(B3)",50,"mg NE",313],["비타민 B6",75,"mg",4412],["엽산(B9)",680,"μg DFE",170],
  ["비타민 B12",300,"μg",12500],["비오틴(B7)",300,"μg",1000],["판토텐산(B5)",50,"mg",1000],
  ["요오드",150,"μg",100],["마그네슘",100,"mg",24],["아연",25,"mg",227],
  ["셀레늄",200,"μg",364],["망간",2,"mg",87],["크로뮴",200,"μg",571],
  ["몰리브데넘",100,"μg",222],["이노시톨",50,"mg",null],["혼합 토코페롤",20,"mg",null],
  ["바이오 퀘르세틴 혼합물",14,"mg",null],["금잔화 추출물",11.12,"mg",null],
  ["아피제닌",5,"mg",null],["라이코펜",1,"mg",null],
];
const twoPerDay={
  name:"Life Extension 투 퍼 데이 멀티비타민 120정",
  label:supplementLabelSchema.parse({productId:"137715",productCode:"LEX-01011",upc:"737870010111",servingSize:2,servingUnit:"정",
    servingsPerContainer:60,facts:facts.map(([name,amount,unit,dailyValuePercent])=>({name,amount,unit,dailyValuePercent})),
  }),
};

const catalog=new Map<string,{name:string;label:SupplementLabel}>([["137715",twoPerDay]]);
function addPowder(productId:string,name:string,productCode:string,upc:string,servingsPerContainer:number,rows:typeof facts){
  catalog.set(productId,{name,label:supplementLabelSchema.parse({
    productId,productCode,upc,servingSize:1,servingUnit:"스쿱",servingsPerContainer,
    facts:rows.map(([name,amount,unit,dailyValuePercent])=>({name,amount,unit,dailyValuePercent})),
  })});
}

addPowder("71026","California Gold Nutrition 크레아틴 일수화물 무맛 454g","CGN-01059","898220010592",91,[
  ["크레아틴 일수화물",5,"g",null],
]);
addPowder("71031","California Gold Nutrition 분리유청단백질 무맛 454g","CGN-01064","898220010646",15,[
  ["열량",120,"kcal",null],["총 지방",0,"g",0],["포화지방",0,"g",0],["트랜스지방",0,"g",null],
  ["콜레스테롤",15,"mg",5],["나트륨",55,"mg",2],["총 탄수화물",0,"g",0],
  ["식이섬유",0,"g",0],["총당류",0,"g",null],["첨가당",0,"g",0],["단백질",27,"g",55],
  ["비타민 D",0,"μg",0],["칼슘",120,"mg",10],["철분",0,"mg",0],["칼륨",130,"mg",2],
]);
addPowder("136132","ALLMAX Essentials EAA 320g","AMX-22988","665553229881",30,[
  ["L-류신",2544,"mg",null],["L-이소류신",1272,"mg",null],["L-발린",1272,"mg",null],
  ["BCAA (류신·이소류신·발린 합계)",5088,"mg",null],["L-라이신",2590,"mg",null],
  ["L-메티오닌",612,"mg",null],["L-페닐알라닌",315,"mg",null],["L-트레오닌",275,"mg",null],
  ["L-히스티딘",150,"mg",null],["L-트립토판",220,"mg",null],["EAA (필수 아미노산 합계)",9250,"mg",null],
]);

export function lookupSupplementLabel(url:string){
  return catalog.get(iherbProductId(url)??"")??null;
}

catalog.set("61865",{
  name:"California Gold Nutrition Gold C 비타민 C 1,000mg 240캡슐",
  label:supplementLabelSchema.parse({
    productId:"61865",productCode:"CGN-00932",upc:"898220009329",
    servingSize:1,servingUnit:"캡슐",servingsPerContainer:240,
    facts:[{name:"비타민 C",amount:1000,unit:"mg",dailyValuePercent:1111}],
  }),
});

catalog.set("95888",{
  name:"California Gold Nutrition 루테인·제아잔틴 베지 소프트젤 60정",
  label:supplementLabelSchema.parse({
    productId:"95888",productCode:"CGN-01408",upc:"898220014088",
    servingSize:1,servingUnit:"소프트젤",servingsPerContainer:60,
    facts:[
      {name:"루테인",amount:20,unit:"mg",dailyValuePercent:null},
      {name:"제아잔틴",amount:1,unit:"mg",dailyValuePercent:null},
    ],
  }),
});

const productAliases:Record<string,string[]>={
  "137715":["투퍼데이","twoperday","two per day multivitamin"],
  "71026":["크레아틴","creatine monohydrate"],
  "71031":["wpi","분리유청단백질","whey protein isolate"],
  "136132":["eaa","allmax essentials eaa"],
  "95888":[
    "California Gold Nutrition (캘리포니아골드뉴트리션), 루테인, 금잔화 추출물 유래 제아잔틴 함유, 베지 소프트젤 60정",
    "California Gold Nutrition Lutein with Zeaxanthin from Marigold Extract 60 Veggie Softgels",
    "루테인 제아잔틴 60정","CGN-01408",
  ],
  "61865":[
    "Gold C 1000mg 240캡슐","Gold C 1000mg 240 Veggie Capsules","CGN-00932",
    "California Gold Nutrition Gold C USP Grade Vitamin C 1000 mg 240 Veggie Capsules",
    "California Gold Nutrition (캘리포니아골드뉴트리션), Gold C®, USP 등급 비타민C, 1,000mg, 베지 캡슐 240정",
  ],
};
const searchKey=(text:string)=>text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");

export function searchSupplementCatalog(query:string){
  const normalized=searchKey(query);
  if(normalized.length<2)return [];
  return [...catalog].flatMap(([id,product])=>{
    if(![product.name,...(productAliases[id]??[])].some(value=>searchKey(value)===normalized))return [];
    const label={...product.label,productId:undefined,webSources:[{title:"iHerb 원본 성분표",url:`https://kr.iherb.com/pr/i/${id}`}]};
    return [{name:product.name,label}];
  });
}
