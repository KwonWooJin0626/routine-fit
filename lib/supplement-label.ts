import { z } from "zod";

export const supplementFactUnits=["g","mg","μg","μg RAE","μg DFE","mg NE","IU","CFU"] as const;
export const supplementServingUnits=["정","캡슐","스쿱","mL","g","포","방울","소프트젤"] as const;
const unit=z.enum(supplementFactUnits);
const fact=z.object({name:z.string().trim().min(1).max(120),amount:z.number().finite().nonnegative().max(1e15),unit,
  dailyValuePercent:z.number().finite().nonnegative().nullable()});
export const supplementLabelSchema=z.object({
  productId:z.string().regex(/^\d+$/).optional(),
  productCode:z.string().max(60).optional(),
  upc:z.string().regex(/^\d{12,14}$/).optional(),
  servingSize:z.number().min(0.000001).max(1000000),
  servingUnit:z.enum(supplementServingUnits),
  servingsPerContainer:z.number().positive().optional(),
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

export function lookupSupplementLabel(url:string){
  return iherbProductId(url)===twoPerDay.label.productId?twoPerDay:null;
}
