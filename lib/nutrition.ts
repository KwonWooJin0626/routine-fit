import type { Answers, Checkin } from "./model";
import { emptyNutritionProfile, type NutritionProfile, type ingredientIds } from "./nutrition-profile";

type IngredientId = typeof ingredientIds[number];
type Food = {name:string;allergens: NutritionProfile["allergens"]; dairy?:boolean; animal?:boolean};
export type Ingredient = {id:IngredientId;name:string;group:string;role:string;benefit:string;limit:string;caution:string;foods:Food[];query:string;source:string;sourceTitle:string;pairing:string;};
const ods=(name:string)=>`https://ods.od.nih.gov/factsheets/${name}-Consumer/`;
const food=(name:string,allergens:Food["allergens"]=[],animal=false,dairy=false):Food=>({name,allergens,animal,dairy});
const sport="https://ods.od.nih.gov/factsheets/ExerciseandAthleticPerformance-HealthProfessional/";
const vegetables=[food("브로콜리·파프리카·키위 중 먹을 수 있는 식품을 식사·간식에 포함하기")];
const plants=[food("콩·두부 반찬",["soy"]),food("통곡물 밥·오트밀 (혼합 원료 확인)",["wheat"]),food("견과류 간식",["nuts"]),food("녹색 잎채소 반찬")];
function item(id:IngredientId,name:string,group:string,role:string,benefit:string,limit:string,caution:string,foods:Food[],query:string,source:string,pairing="식사·현재 제품과 겹치는 성분을 먼저 확인해요. 함께 먹는다고 추가 효과가 보장되지는 않아요."):Ingredient{return {id,name,group,role,benefit,limit,caution,foods,query,source,sourceTitle:source===sport?"NIH · Dietary Supplements for Exercise and Athletic Performance":id==="milkthistle"?"NCCIH · Milk Thistle":`NIH · ${name}`,pairing};}
export const ingredients:Ingredient[]=[
  item("protein","단백질","기본 영양소","근육을 포함한 신체 조직의 유지·회복에 필요한 영양소예요.","운동과 함께 충분한 단백질 섭취는 근육 적응과 회복을 뒷받침해요.","식사로 충분히 섭취한다면 쉐이크를 추가할 필요가 없을 수 있어요.","우유 알레르기에서는 WPC·WPI 모두 제외해요. WPI라는 이름만으로 무유당을 보장하지 않아요.",[food("달걀 반찬",["egg"],true),food("닭고기·생선 반찬",["fish"],true),food("콩·두부 반찬",["soy"])],"protein powder",sport,"단백질 제품에 EAA·BCAA가 포함될 수 있어요. 별도 아미노산을 필수 조합처럼 추가하지 않아요."),
  item("b12","비타민 B12","비타민","정상적인 신경 기능과 적혈구 형성에 필요해요.","식단 제한 등으로 섭취가 부족한 경우 보충 방법을 검토할 수 있어요.","피로만으로 B12 결핍을 진단할 수 없어요.","검사상 결핍이 있다면 원인과 보충 방법을 의료진에게 확인하세요.",[food("B12 강화식품 (강화 여부와 원료 확인)",["soy"]),food("달걀·생선",["egg","fish"],true)],"vitamin B12",ods("VitaminB12")),
  item("bcomplex","비타민 B군","비타민","여러 B 비타민이 에너지 대사와 세포 기능에 관여해요.","다양한 B 비타민의 섭취 상태를 함께 살펴볼 수 있어요.","B군을 더 먹는다고 즉각적인 활력·집중력 향상이 보장되지 않아요. B5·비오틴도 B군에 속해요.","B6·나이아신·엽산 등 전체 함량을 확인하세요. 고함량 제품을 기본값으로 추천하지 않아요.",plants,"vitamin B complex",ods("MVMS")),
  item("c","비타민 C","비타민","콜라겐 형성과 항산화 기능에 관여해요.","비타민 C가 있는 채소·과일을 다양하게 챙길 수 있어요.","이미 충분히 섭취하는 경우 추가 보충의 이점을 단정하지 않아요.","과량 섭취는 위장 불편을 유발할 수 있어요. 질환·복용약이 있다면 확인이 필요해요.",vegetables,"vitamin C",ods("VitaminC")),
  item("d","비타민 D","비타민","칼슘 흡수와 뼈·근육 기능에 관여해요.","섭취·검사 결과·개인 상태에 따라 보충 필요성을 검토할 수 있어요.","실내 생활만으로 결핍이나 필요한 보충량을 확정하지 않아요.","고함량 장기 복용은 피하고 기존 제품과의 중복을 확인하세요.",[food("비타민 D 강화식품 (표시 확인)",["milk"],true,true),food("생선·달걀",["fish","egg"],true)],"vitamin D",ods("VitaminD")),
  item("a","비타민 A","비타민","정상적인 시각과 면역 기능에 필요해요.","다양한 식품으로 적절한 섭취를 유지하는 데 초점을 맞춰요.","고함량 보충제를 보편적으로 추천하지 않아요.","임신 가능성·간 질환·다른 제품의 비타민 A 형태와 함량을 확인해야 해요.",[food("당근·단호박·녹색 잎채소")],"vitamin A",ods("VitaminA")),
  item("e","비타민 E","비타민","세포를 산화 손상으로부터 보호하는 역할을 해요.","견과류·씨앗류 등 식품을 통해 섭취를 살펴볼 수 있어요.","항산화 기능이 있다고 질병 예방 효과가 보장되지는 않아요.","고함량·항응고제 병용 등은 전문가 확인이 필요해요.",[food("견과류·씨앗류",["nuts","sesame"])],"vitamin E",ods("VitaminE")),
  item("k","비타민 K","비타민","혈액 응고와 뼈 관련 단백질 기능에 필요해요.","녹색 채소 등으로 섭취 상태를 살펴볼 수 있어요.","복용약에 따라 섭취 관리가 달라져요.","와파린 등 복용 시 임의로 섭취를 늘리거나 줄이지 말고 의료진과 상의하세요.",[food("녹색 잎채소")],"vitamin K",ods("VitaminK")),
  item("b5","판토텐산 · B5","비타민","음식을 에너지로 바꾸고 지방을 만들고 분해하는 과정에 관여해요.","다양한 식품에서 섭취할 수 있는 B 비타민이에요.","일반적인 피로나 피부 고민만으로 고함량 보충을 추천하지 않아요.","B군·멀티 제품의 판토텐산과 중복될 수 있어요.",[food("버섯·통곡물 요리",["wheat"]),food("달걀",["egg"],true)],"pantothenic acid",ods("PantothenicAcid")),
  item("biotin","비오틴 · B7","비타민","탄수화물·지방·단백질의 대사에 관여하는 B 비타민이에요.","섭취가 부족한 특수 상황에서 보충을 검토할 수 있어요.","일반적인 모발·손톱·피부 개선 효과를 보장할 근거는 제한적이에요.","일부 혈액검사 결과에 영향을 줄 수 있어요. 검사 전 복용 사실을 의료진에게 알리세요.",[food("익힌 달걀",["egg"],true),food("견과류",["nuts"])],"biotin",ods("Biotin")),
  item("omega","오메가-3","지방산","ALA·EPA·DHA 등 여러 종류가 있는 지방산이에요.","생선 등 급원 식품의 섭취와 EPA·DHA 보충 선택지를 살펴볼 수 있어요.","식물성 ALA와 EPA·DHA는 같지 않아요. 일반 보충제가 질병 치료를 대신하지 않아요.","해산물 알레르기·복용약·수술 예정은 확인이 필요해요. 원료와 실제 EPA·DHA 함량을 확인하세요.",[food("생선 반찬",["fish"],true),food("아마씨·호두 (ALA 공급원)",["nuts"])],"omega 3",ods("Omega3FattyAcids")),
  item("zinc","아연","미네랄","정상적인 면역 기능과 단백질·DNA 합성에 필요해요.","식단 제한과 식품 선택을 고려해 섭취 상태를 살펴볼 수 있어요.","면역 기능에 필요하다는 것이 추가 복용 시 감염 예방을 보장한다는 뜻은 아니에요.","과량·장기 복용과 약물 상호작용에 주의하고 멀티 제품과의 중복을 확인하세요.",[food("고기 반찬",[],true),food("콩류",["soy"])],"zinc",ods("Zinc")),
  item("magnesium","마그네슘","미네랄","정상적인 근육·신경 기능과 에너지 대사에 필요해요.","콩류·통곡물·잎채소 등 식품 섭취를 함께 점검할 수 있어요.","피로·불면만으로 부족을 진단하거나 수면 개선을 보장하지 않아요.","신장질환·복용약 확인이 필요하고 보충제는 설사 등 위장 불편을 유발할 수 있어요.",plants,"magnesium",ods("Magnesium")),
  item("calcium","칼슘","미네랄","뼈·치아 유지와 근육 기능 등에 필요해요.","식품의 실제 칼슘 함량과 강화 여부를 살펴보세요.","유제품을 안 먹는다고 곧바로 칼슘 부족은 아니에요.","결석·신장질환·복용약을 확인하세요. 식품과 보충제를 함께 고려해야 해요.",[food("칼슘 강화 두유",["soy"]),food("두부 (응고제·함량 확인)",["soy"]),food("우유·요거트",["milk"],true,true)],"calcium",ods("Calcium")),
  item("iron","철","미네랄","산소 운반에 필요한 헤모글로빈 형성 등에 관여해요.","식단·검사 결과를 바탕으로 필요성을 검토하는 성분이에요.","피곤하다는 이유만으로 철 보충제를 추천하지 않아요.","검사와 의료진 확인 없이 철 제품을 추가하지 마세요. 과잉 섭취가 해로울 수 있어요.",[food("고기 반찬",[],true),food("콩류",["soy"])],"iron",ods("Iron")),
  item("creatine","크레아틴","운동 보충 성분","짧고 강한 운동에서 근육의 에너지 공급에 관여해요.","반복적인 고강도·근력운동에서 근력·파워 향상에 도움이 될 수 있어요.","모든 운동에 같은 효과가 있는 것은 아니고 지구력 운동의 기본 추천은 아니에요.","수분 저류에 따른 체중 증가·위장 불편이 생길 수 있어요. 질환·복용약은 전문가 확인이 필요해요.",[],"creatine monohydrate",sport,"식사·운동 계획이 기본이에요. 단백질·아미노산 제품을 반드시 함께 구매할 필요는 없어요."),
  item("eaa","EAA · 필수아미노산","운동 보충 성분","단백질 합성에 필요한 필수아미노산을 공급하는 선택지예요.","식사와 단백질 섭취가 어려운 상황에서 보충 방법을 비교할 수 있어요.","충분한 완전단백질을 먹는 사람에게 별도 EAA가 반드시 필요한 것은 아니에요.","단백질·BCAA 제품과 공급 성분이 겹칠 수 있어요.",[food("달걀·생선",["egg","fish"],true),food("다양한 콩·곡류 조합",["soy","wheat"])],"essential amino acids",sport),
  item("bcaa","BCAA","운동 보충 성분","류신·이소류신·발린 세 가지 아미노산을 뜻해요.","근육 단백질의 구성 성분이며 식품과 단백질 제품에도 들어 있어요.","충분한 단백질 섭취를 넘어서는 추가 효과는 일관되게 입증되지 않았어요. 기본 우선 추천에서는 제외해요.","EAA·단백질 제품과 중복 확인이 필요해요. 운동 횟수만으로 권하지 않아요.",[food("달걀·콩류",["egg","soy"])],"BCAA",sport),
  item("milkthistle","밀크시슬","식물성 성분","실리마린 등 성분을 포함하는 식물 추출물이에요.","간 건강 관련 연구가 있지만 효과를 단정하기에는 근거가 부족하거나 상충해요.","간 해독·숙취 해소·음주 피해 예방이나 간 질환 치료를 보장하지 않아요. 기본 우선 추천에서는 제외해요.","국화과 식물 알레르기·복용약·임신·수유 관련 확인이 필요해요.",[],"milk thistle","https://www.nccih.nih.gov/health/milk-thistle"),
];

export function supplementHolds(a:Answers,p:NutritionProfile):string[]{
  const reasons:string[]=[];
  if(a.basic&&!a.basic.nutritionAgeKnown)reasons.push("제품 비교 전 연령대 확인이 필요해요.");
  if(a.basic&&a.basic.supplementStatus!=="none")reasons.push("현재 제품·함량·섭취 횟수가 확인되지 않았어요. 성분 선택만으로 중복이나 병용 가능 여부를 확정하지 않아요.");
  if(a.safetyReviewed!==true)reasons.push("기본 문진의 안전정보를 직접 확인해주세요.");
  if(!p.reviewed || p.allergyStatus==="unknown")reasons.push("음식·섭취 프로필 확인이 필요해요.");
  if(a.conditions||a.medicines||a.pregnancy||a.surgery||a.uncertainSafety||a.age==="65+")reasons.push("질환·복용약·생애단계 또는 불확실한 정보는 전문가 확인이 필요해요.");
  if(a.allergy||p.allergyStatus==="known"||p.allergens.length||p.allergyNotes.trim())reasons.push("알레르기 사용자에게 안전한 제품인지 실제 라벨·교차접촉 검토가 필요해요. 현재는 상품 추천을 보류해요.");
  if(a.currentSupplements.trim()||a.confirmedDeficiency.trim())reasons.push("현재 제품·검사 소견이 있어 중복·보충 방법의 전문가 확인이 필요해요.");
  if(p.digestiveNotes.trim()||p.avoidFoods.trim()||a.diet==="restricted")reasons.push("자유 입력한 불편·제한 식단은 자동 판정하지 않아요. 원료를 확인하기 전 제품 연결을 보류해요.");
  return reasons;
}
export function foodOptions(i:Ingredient,a:Answers,p:NutritionProfile=emptyNutritionProfile()):Food[]{
  if(!p.reviewed||p.allergyStatus==="unknown"||a.diet==="restricted"||p.allergens.includes("other")||p.allergyNotes.trim()||p.digestiveNotes.trim()||p.avoidFoods.trim()||a.allergy&&p.allergyStatus!=="known")return [];
  return i.foods.filter(f=>!f.allergens.some(x=>p.allergens.includes(x))&&!(f.dairy&&p.lactose!=="comfortable")&&!(f.animal&&(a.diet==="vegan"||p.proteinSource==="plant"))&&!(a.diet==="vegetarian"&&f.animal&&!f.dairy&& !f.allergens.includes("egg")));
}
export function rankIngredients(a:Answers,p:NutritionProfile=emptyNutritionProfile()){
  if(!a.supplementOptIn)return [];
  if(a.basic)return [];
  const rows:{ingredient:Ingredient;reason:string;score:number}[]=[];
  const add=(id:IngredientId,score:number,reason:string)=>rows.push({ingredient:ingredients.find(i=>i.id===id)!,score,reason});
  if(a.diet==="vegan"||a.diet==="vegetarian")add("b12",100,"채식 식단을 선택하셨어요. B12 급원·강화식품 섭취를 먼저 확인해요.");
  if(p.proteinIntake!=="adequate"&&(a.protein<4||p.proteinIntake==="difficult"))add("protein",90,`단백질 식품을 주 ${a.protein}일 먹거나 챙기기 어렵다고 답하셨어요. 실제 섭취량은 아직 확정하지 않아요.`);
  if(a.fish<2)add("omega",75,`생선 섭취가 주 ${a.fish}일이에요. EPA·DHA 급원과 식단을 살펴봐요. 부족 진단은 아니에요.`);
  if(a.dairy<3)add("calcium",65,"유제품·대체식품 섭취 빈도가 낮아요. 칼슘 강화식품과 실제 섭취량부터 확인해요.");
  if(a.vegetables+a.fruit<6)add("c",60,"채소·과일 섭취 빈도를 바탕으로 급원 식품을 살펴봐요. 보충제 필요성을 확정하지 않아요.");
  if(a.goal==="fitness"&&a.strengthDays>=2)add("creatine",55,"평소 근력운동과 운동 목표를 바탕으로 검토할 수 있어요. 오늘 운동 시간만으로 추천하지 않아요.");
  if(a.legumeDays!=null&&a.wholegrainDays!=null&&a.legumeDays<3&&a.wholegrainDays<3)add("magnesium",50,"콩류·통곡물 섭취 빈도가 낮다고 답하셨어요. 다른 급원 식품도 함께 확인해요.");
  return rows.sort((x,y)=>y.score-x.score).slice(0,5);
}
export function proteinDirections(a:Answers,p:NutritionProfile):{title:string;detail:string;query:string}[]{
  if(a.allergy||p.allergyStatus!=="none"||p.allergens.length)return [{title:"제품 확정 보류",detail:"알레르기 원료와 실제 제품 라벨 검토가 먼저 필요해요. 우유 알레르기에 WPI도 대안이 아니에요.",query:""}];
  const plant=p.proteinSource==="plant"||a.diet==="vegan";
  const options=[];
  if(!plant && p.proteinSource!=="plant"){
    if(p.lactose==="comfortable")options.push({title:"WPC · 농축유청단백",detail:"유제품이 편한 경우 비교 후보예요. 단백질 함량·가격·부원료를 함께 확인해요.",query:"whey protein concentrate"});
    if(p.lactose!=="unknown")options.push({title:"WPI · 분리유청단백",detail:"대체로 유당이 적지만 무유당을 보장하지 않아요. 최종 제품의 유당·혼합 원료 확인이 필요해요.",query:"whey protein isolate"});
  }
  if(p.proteinSource!=="dairy"||plant)options.push({title:"식물성 단백질",detail:"대두·완두 등 원료, 아미노산 구성과 교차접촉 경고를 확인해요. 식물성이라고 알레르기 안전을 보장하지 않아요.",query:"plant based protein"});
  return options.length?options:[{title:"유제품 반응을 먼저 확인해주세요",detail:"원인을 모르는 불편은 유당불내증으로 진단하지 않아요.",query:""}];
}
export const formatChoices={single:"단일 성분",multi:"복합 제품",both:"둘 다 비교",unsure:"아직 모르겠어요"} as const;
export const formatComparison=[{name:"단일 성분",good:"필요한 성분만 선택·변경·중단하기 편해요.",bad:"제품 수·비용·섭취 부담이 늘고, 제품 간 중복 확인이 필요해요."},{name:"복합 제품",good:"여러 성분을 한 제품으로 관리하기 편해요.",bad:"불필요한 성분도 포함될 수 있고 개별 함량 조절이 어려워요."},{name:"혼합 방식",good:"필요할 때 복합 제품과 일부 단일 제품을 비교할 수 있어요.",bad:"중복이 쉬워요. 자동으로 추가 제품을 묶어 권하지 않아요."}];
