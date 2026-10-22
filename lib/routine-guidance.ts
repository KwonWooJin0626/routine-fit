import type { Answers, Routine, RoutineGuidance } from "./model";
import { emptyNutritionProfile, type NutritionProfile } from "./nutrition-profile";
import { foodOptions, ingredients } from "./nutrition";

const sources = {
  protein:{label:"USDA MyPlate · 단백질 식품",url:"https://www.myplate.gov/web/web/eat-healthy/protein-foods"},
  vitaminA:{label:"NIH · 비타민 A와 식품",url:"https://ods.od.nih.gov/factsheets/VitaminA-Consumer/"},
  vitaminC:{label:"NIH · 비타민 C와 식품",url:"https://ods.od.nih.gov/factsheets/VitaminC-Consumer/"},
  folate:{label:"NIH · 엽산과 식품",url:"https://ods.od.nih.gov/factsheets/Folate-Consumer/"},
  dairy:{label:"USDA MyPlate · 유제품·강화 대체식품",url:"https://www.myplate.gov/web/eat-healthy/dairy"},
  music:{label:"NIH NCCIH · 음악과 건강, 근거와 한계",url:"https://www.nccih.nih.gov/health/music-and-health-what-you-need-to-know"},
  sleep:{label:"NIH NHLBI · 수면 전 조용한 시간",url:"https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits"},
};
type Item = RoutineGuidance["items"][number];
const item=(name:string,note:string):Item=>({name,note});
const foodIds = new Set(["food-first","food-color","food-protein","food-menu","food-fruit","food-plan","food-label"]);

function foodGuidance(id:string,a:Answers):RoutineGuidance|undefined {
  if(!foodIds.has(id))return;
  const plantOnly = a.diet === "vegan" || a.diet === "vegetarian";
  const vegetables = [
    item("브로콜리 · 파프리카","비타민 C 공급원이에요. 비타민 C는 피부 등 결합조직을 구성하는 콜라겐 형성과 정상적인 면역 기능에 필요해요."),
    item("당근 · 단호박","베타카로틴을 제공해요. 몸에서 비타민 A로 전환될 수 있으며 정상적인 시각 기능과 면역 기능 유지에 필요해요."),
    item("시금치 등 짙은 잎채소","엽산을 제공해요. 엽산은 DNA 등 유전물질을 만들고 세포가 나뉘는 과정에 필요해요."),
  ];
  const protein = [
    item("식물성 · 두부 · 콩","고기 대신 식물성 식품을 고르고 싶은 식사에 곁들여요. 단백질은 근육·피부 등 몸의 조직을 만들고 유지하는 구성 성분이에요."),
    item("식물성 · 렌틸콩 · 병아리콩","샐러드나 수프에 더하는 선택지예요. 식물성 단백질과 식이섬유를 제공해요."),
    ...(!plantOnly ? [item("동물성 · 익힌 달걀","간단히 준비하는 식사에 곁들일 수 있어요. 조직 유지에 필요한 단백질을 더하는 선택지예요."),item("동물성 · 껍질을 제거한 닭고기 · 생선","주요리를 고를 때의 단백질 식품 예시예요. 단백질은 조직과 효소 등을 구성해요.")] : []),
  ];
  const fruits=[item("키위 · 딸기 · 귤·오렌지","비타민 C를 포함하는 과일 예시예요. 비타민 C는 콜라겐 형성과 정상적인 면역 기능에 필요해요."),item("칸탈루프 멜론 · 망고","비타민 A로 전환될 수 있는 카로티노이드 급원이에요. 비타민 A는 정상적인 시각 기능 유지에 필요해요.")];
  const menus=[item("두부·콩 + 채소 + 밥","단백질 식품·채소·곡류를 함께 고르는 조합 예시예요. 두부·콩은 조직 구성에 필요한 단백질을 더해줘요."),item("콩 수프 + 통곡물빵 + 채소","바쁜 날 준비 가능한 식사 조합 예시예요. 콩의 단백질과 채소의 다양한 영양소를 함께 선택할 수 있어요."),...(!plantOnly?[item("달걀 + 채소 + 밥","달걀의 단백질과 채소를 함께 포함하는 식사 예시예요."),item("플레인 요거트 + 과일","간단히 준비할 수 있는 조합이에요. 요거트의 단백질과 칼슘을 함께 확인할 수 있고, 칼슘은 뼈·치아 유지에 필요해요.")]:[item("칼슘 강화 두유 + 과일","제품 라벨에서 단백질과 칼슘 강화 여부를 확인하세요. 칼슘은 뼈·치아 유지에 필요한 영양소예요.")])];
  let items:Item[], refs:RoutineGuidance["sources"];
  if(id==="food-color"){items=vegetables;refs=[sources.vitaminC,sources.vitaminA,sources.folate];}
  else if(id==="food-protein"){items=protein;refs=[sources.protein];}
  else if(id==="food-fruit"){items=fruits;refs=[sources.vitaminC,sources.vitaminA];}
  else if(id==="food-label"){items=[item("두부·콩 제품의 단백질 표시","단백질은 근육 등 조직의 구성 성분이에요. 1회 제공량과 실제 먹는 양을 구분해서 살펴보세요."),item("두유·요거트의 칼슘 강화 표시","같은 식품군이라도 제품별 함량이 달라요. 칼슘은 뼈·치아 유지에 필요하며 모든 대체음료가 같은 양을 제공하지는 않아요.")];refs=[sources.protein,sources.dairy];}
  else{items=menus;refs=[sources.protein,sources.dairy];}
  const uncertain = a.allergy || a.diet === "restricted";
  return {kind:"food",heading:"추천 식품 · 어떤 영양을 더할까요?",intro:uncertain?"알레르기 또는 특정 식품 제한의 상세정보를 알 수 없어 구체적인 식품 추천은 보류했어요.":plantOnly?"채식·비건 응답을 참고해 식물성 식품 중심의 예시를 보여드려요. 실제로 허용되는 식품인지 직접 확인하세요.":"아래는 골라볼 수 있는 식품 예시예요. 음식 이름뿐 아니라 포함된 영양소가 몸에서 하는 역할도 함께 살펴보세요.",items:uncertain?[]:items,caution:"영양소의 일반적인 역할을 설명하는 참고 정보이며 질병 치료·결핍 개선을 보장하지 않아요. 알레르기·질환·복용약·치료식에 따라 맞지 않을 수 있고, 실제 함량은 제품·양·조리법마다 달라요. 개인 식이 지침이 있으면 의료진·영양전문가의 안내를 우선하세요.",sources:refs};
}

const musicGuide=(items:Item[],intro:string):RoutineGuidance=>({kind:"music",heading:"상황에 맞는 음악 장르",intro,items,caution:"장르 추천은 상황과 취향에 따른 선택지이며 치료 효과나 수면·스트레스 개선을 보장하지 않아요. 편한 음량으로 듣고 불편한 감정이 들면 다른 곡을 고르세요. 이동·조리 중에는 주변 소리를 들을 수 있도록 주의하세요.",sources:[sources.music]});
const readingGuide=(items:Item[],intro:string,sleep=false):RoutineGuidance=>({kind:"reading",heading:"어떤 글을 읽어볼까요?",intro,items,caution:sleep?"잠을 미루면서 읽지 말고 졸리면 마무리하세요. 밝은 화면이나 자극적인 내용이 불편하면 종이책의 짧고 편한 글을 골라요. 독서는 수면장애 치료를 대신하지 않아요.":"내용이 부담스럽거나 내 상황에 맞지 않으면 다른 글을 고르세요. 읽기는 앉거나 멈춘 안전한 장소에서 하고, 건강정보는 출처와 작성일을 확인하세요.",sources:sleep?[sources.sleep]:[]});

const media:Record<string,RoutineGuidance>={
  "sleep-read":readingGuide([item("잔잔한 에세이","짧게 끊어 읽을 수 있는 편한 일상 이야기를 골라요."),item("시집 · 짧은 산문","몇 편만 읽고 잠들 준비로 이어가기 쉬운 분량을 골라요."),item("익숙한 단편소설","다음 내용이 궁금해 잠을 미루게 되는 작품은 피하고 편한 글을 선택해요.")],"취침 전 조용한 시간에 읽을 분야 예시예요. 종이책이나 편안한 밝기의 환경에서 짧게 읽어보세요.",true),
  "sleep-music":musicGuide([item("앰비언트","큰 음량 변화나 강한 박자가 적은 잔잔한 연주를 골라요."),item("솔로 피아노 · 어쿠스틱 기타","가사 없이 편안하게 들을 수 있는 곡을 취향에 맞게 골라요."),item("느린 클래식 연주곡","장르 이름보다 실제로 내게 편안한 곡인지 먼저 확인해요.")],"잠들 준비를 할 때의 선택 예시예요. 잠을 미루지 않도록 짧게 듣거나 종료 타이머를 활용하세요."),
  "food-read":readingGuide([item("공공기관의 영양표시 안내","제공량·성분·알레르기 표시 읽는 방법을 한 문단 살펴봐요."),item("간단한 채소·콩 요리 글","내 식이 제한에 맞는 재료로 만들 수 있는 메뉴 하나를 찾아요."),item("식품 보관·위생 안내","식재료를 안전하게 준비하는 방법을 읽어요.")],"식사 중 화면을 보도록 권하는 것이 아니라, 식사 준비 전 잠깐 읽는 루틴이에요."),
  "food-music":musicGuide([item("보사노바","식사 준비 때 배경으로 틀 수 있는 부드러운 곡을 골라요."),item("어쿠스틱 팝 · 포크","대화와 조리에 방해되지 않는 편한 음량으로 들어요."),item("잔잔한 재즈 연주곡","가사보다 연주를 선호할 때 선택해볼 수 있어요.")],"식사 준비나 식탁 정리를 위한 분위기 선택이에요. 특정 장르가 소화나 영양 흡수를 높인다는 의미는 아니에요."),
  "move-read":readingGuide([item("걷기·가벼운 활동 안전수칙","불편하면 중단하고 내 몸 상태에 맞춰 움직이는 원칙을 읽어요."),item("산책길의 문화·자연 안내 글","걷기 전에 경로와 볼거리를 살펴봐요. 걸으면서 읽지는 않아요.")],"움직이기 전에 앉거나 멈춘 상태에서 읽는 준비 루틴이에요. 운동 강도·횟수를 처방하는 콘텐츠는 아니에요."),
  "move-music":musicGuide([item("밝은 팝 · K-pop","몸을 과하게 몰아붙이지 않고 내 속도를 유지할 수 있는 곡을 골라요."),item("펑크 · 디스코","가벼운 실내 움직임에 곁들이고 박자에 억지로 맞추지는 않아요."),item("인디 팝 · 경쾌한 연주곡","편한 리듬을 선호할 때 선택할 수 있어요.")],"안전한 실내에서 가볍게 움직일 때의 선택 예시예요. 야외에서는 교통과 주변 소리를 듣는 것이 우선이에요."),
  "mind-read":readingGuide([item("좋아하는 소설 · 단편집","정해진 진도 없이 즐길 수 있는 몇 쪽을 골라요."),item("여행·취미 에세이","잠깐 일에서 벗어나 관심 있는 주제를 읽어요."),item("시집 · 그림이 있는 책","긴 글이 부담스러운 날 짧은 분량으로 시작해요.")],"쉬는 시간에 읽을 분야 예시예요. 집중력이나 기분의 개선을 보장하는 치료 루틴은 아니에요."),
  "mind-focus-read":readingGuide([item("관심 분야의 교양서","한 문단을 읽고 기억하고 싶은 내용을 한 줄 남겨요."),item("짧은 비문학 글","읽을 분량을 작게 정하고 무리하지 않아요.")],"가볍게 읽고 생각을 정리하고 싶을 때 고를 수 있는 독서 루틴이에요."),
  "mind-music":musicGuide([item("로파이 힙합 · 칠합","잔잔한 반복 리듬을 좋아할 때 선택해요."),item("재즈 연주곡 · 네오소울","부드러운 연주나 보컬을 선호할 때 골라요."),item("어쿠스틱 · 인디 포크","따뜻한 음색이 편하게 느껴지면 선택해요.")],"짧게 쉬고 싶을 때의 장르 예시예요. 내가 좋아하고 편한 곡을 고르는 것이 우선이에요."),
  "mind-music-bright":musicGuide([item("밝은 인디 팝 · 시티팝","가벼운 분위기의 곡을 듣고 싶을 때 골라요."),item("소울 · 펑크","기분에 맞는 리듬을 선택하고 듣기 싫은 곡은 건너뛰어요."),item("좋아하는 팝 · K-pop","익숙하고 즐거운 곡으로 짧은 휴식 시간을 만들어요.")],"분위기를 바꿔 쉬고 싶은 날의 선택 예시예요. 즐겁게 느껴지는 곡은 사람마다 달라요."),
};

export function guidanceForRoutine(r:Pick<Routine,"id"|"source"|"guidance">,a:Answers,profile?:NutritionProfile|null):RoutineGuidance|undefined {
  if(r.source==="custom")return r.guidance;
  const guide=foodGuidance(r.id,a)??media[r.id]??r.guidance;
  if(guide?.kind!=="food"||profile===undefined)return guide;
  const ingredient=ingredients.find(i=>i.id===(r.id==="food-color"||r.id==="food-fruit"?"c":"protein"))!;
  const foods=foodOptions(ingredient,a,profile??emptyNutritionProfile());
  return {...guide,intro:foods.length?"저장한 음식정보로 원료를 걸러낸 예시예요. 실제 조리법·교차접촉·포장 라벨을 추가 확인하세요.":"식품 예시는 음식정보 확인 전 보류해요. 영양제 가이드에서 음식·섭취 프로필을 확인해주세요.",items:foods.map(f=>({name:f.name,note:ingredient.role})),caution:guide.caution};
}

export function routineSearchText(r:Routine):string {
  const kind = r.guidance?.kind === "reading" ? "독서 책 읽기" : r.guidance?.kind === "music" ? "음악 장르 듣기" : r.guidance?.kind === "food" ? "식품 영양 추천" : "";
  return `${r.title} ${r.detail} ${kind} ${r.guidance?.heading??""} ${r.guidance?.items.map(i=>`${i.name} ${i.note}`).join(" ")??""}`;
}
