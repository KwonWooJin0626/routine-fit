import type { Routine } from "./model";

// Titles are paraphrased labels, not reproduced questionnaires. Reviewed 2026-10-14.
export const evidence = {
  sleep:{title:"AASM·SRS — 성인 수면시간 합의문 (2015)",url:"https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf"},
  sleepAge:{title:"CDC — 연령별 수면시간과 수면의 질 (2024)",url:"https://www.cdc.gov/sleep/about/"},
  habits:{title:"NIH NHLBI — 건강한 수면 습관",url:"https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits"},
  psqi:{title:"피츠버그대학교 — PSQI 평가도구·사용 조건",url:"https://www.sleep.pitt.edu/research/measures-and-study-instruments"},
  activity:{title:"WHO — 신체활동·좌식생활 가이드라인 (2020)",url:"https://www.who.int/publications/i/item/9789240015128"},
  gpaq:{title:"WHO — 신체활동 설문 GPAQ 안내",url:"https://www.who.int/teams/noncommunicable-diseases/surveillance/systems-tools/physical-activity-surveillance"},
  diet:{title:"WHO — 건강한 식사 기준 (2026)",url:"https://www.who.int/en/news-room/fact-sheets/detail/healthy-diet"},
  nq:{title:"한국 성인을 위한 영양지수 개정: NQ-2021 (2022)",url:"https://www.e-jnh.org/DOIx.php?id=10.4163/jnh.2022.55.2.278"},
  kdri:{title:"한국영양학회 — 2025 한국인 영양소 섭취기준",url:"https://www.kns.or.kr/fileroom/publication.asp"},
  protein:{title:"USDA MyPlate — 단백질 식품",url:"https://www.myplate.gov/web/web/eat-healthy/protein-foods"},
  stress:{title:"WHO — 스트레스에 대처하기",url:"https://www.emro.who.int/mhps/dealing_with_stress.html"},
  pss:{title:"CMU — PSS 평가도구·해석 한계·사용 조건",url:"https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/index.html"},
  music:{title:"NIH NCCIH — 음악과 건강: 근거와 한계",url:"https://www.nccih.nih.gov/health/music-and-health-what-you-need-to-know"},
  supplements:{title:"NIH ODS — 영양제 선택 시 알아둘 사항",url:"https://ods.od.nih.gov/HealthInformation/DS_WhatYouNeedToKnow.aspx"},
} as const;
export type EvidenceId=keyof typeof evidence;
export type EvidenceInfo={ids:EvidenceId[];note:string};
const service:EvidenceInfo={ids:[],note:"ROUTINE FIT 자체 질문 · 목표·시간·환경에 맞추기 위한 정보이며 의학적 평가 기준은 아닙니다."};
const groups:{keys:string[];ids:EvidenceId[];note:string}[]=[
  {keys:["age"],ids:["sleepAge"],note:"연령에 따라 수면 기준의 적용 범위를 구분합니다."},
  {keys:["bed","wake","weekendShift","scheduleShiftHours","caffeine","caffeineTime","lateMeals"],ids:["habits"],note:"생활습관 안내를 참고한 자체 질문이며 공식 평가도구 점수가 아닙니다."},
  {keys:["sleepHours","sleep"],ids:["sleep","sleepAge"],note:"수면시간 비교용 자기보고입니다. 오늘의 수면 한 번으로 평소 수면이나 질환을 판단하지 않습니다."},
  {keys:["sleepQuality","sleepSymptoms"],ids:["sleepAge","psqi"],note:"수면의 질과 불편을 확인하는 자체 질문입니다. PSQI 원문 설문·점수를 적용한 것이 아닙니다."},
  {keys:["vegetables","fruit","fish","dairy","skip","alcohol","wholegrainDays","legumeDays","processedMeatDays"],ids:["diet","nq"],note:"식사의 다양성과 식행동을 살펴보는 자체 질문입니다. 공식 NQ 점수나 영양소 결핍 진단이 아닙니다."},
  {keys:["protein"],ids:["protein","diet"],note:"섭취 빈도만으로 단백질 섭취량이나 부족 여부를 확정하지 않습니다."},
  {keys:["fruitVegGrams"],ids:["diet"],note:"채소·과일 하루 400g 기준과 비교하는 대략적 자기보고입니다. 감자 등 전분성 뿌리식품과 주스는 제외합니다."},
  {keys:["meals","regularMeals","diet","takeaway","water"],ids:["diet"],note:"식사 맥락을 확인하는 자체 질문입니다. 모든 사람에게 같은 식사 횟수·물 섭취량을 처방하지 않습니다."},
  {keys:["exerciseDays","exerciseMinutes","exerciseIntensity","moderateWeeklyMinutes","vigorousWeeklyMinutes","sitting"],ids:["activity","gpaq"],note:"WHO 기준 비교를 위한 자체 질문입니다. GPAQ 원문·공식 설문 점수는 아닙니다. 같은 활동은 중복 계산하지 않습니다."},
  {keys:["strengthDays","strengthAllGroups"],ids:["activity"],note:"주요 근육군을 사용하는 중강도 이상 근력운동 주 2일 기준을 참고합니다."},
  {keys:["stress","energy"],ids:["stress","pss"],note:"주관적 상태를 확인하는 자체 질문입니다. PSS 점수·임상 위험등급으로 환산하거나 두 응답을 합산하지 않습니다."},
  {keys:["conditions","medicines","pregnancy","surgery","allergy","uncertainSafety","currentSupplements","confirmedDeficiency","safetyDetails","movementLimit","unwell"],ids:["supplements","activity"],note:"안전 확인용 자체 질문입니다. 질환·복약·제한이 있으면 전문가의 개별 지침을 우선합니다."},
];
export function questionEvidence(key:string):EvidenceInfo {return groups.find(g=>g.keys.includes(key))??service;}
export function routineEvidence(r:Pick<Routine,"id"|"source"|"category">):EvidenceInfo {
  if(r.id.startsWith("growth-"))return {ids:[],note:"작은 실천을 돕기 위한 서비스 자체 제안이에요. 특정 시간·분량의 효과를 검증한 외부 근거를 적용한 것은 아니에요."};
  if(r.source==="custom"||r.id.startsWith("custom-"))return {ids:[],note:"직접 만든 루틴입니다. 서비스가 외부 근거나 안전성을 검증한 활동이 아닙니다."};
  if(["food-table","sleep-room","move-posture","mind-screen","mind-priority"].includes(r.id))return {ids:[],note:"실행 편의를 위한 서비스 자체 제안입니다. 해당 행동·분량의 효과를 검증한 외부 근거를 적용한 것은 아닙니다."};
  if(r.id.includes("music"))return {ids:r.category==="sleep"?["music","habits"]:["music"],note:"음악 관련 배경 자료입니다. 장르·곡·분량은 취향에 따른 서비스 제안이며 치료 효과를 보장하지 않습니다."};
  if(r.id.includes("read"))return {ids:r.category==="sleep"?["habits"]:r.category==="food"?["diet"]:r.category==="move"?["activity"]:[],note:"독서 분야·시간은 서비스 자체 제안입니다. 자료는 해당 생활습관의 배경이며 독서 효과를 검증한 근거는 아닙니다."};
  if(r.category==="sleep")return {ids:["habits"],note:"수면 습관 안내를 참고했습니다. 구체적인 시간·분량·순서는 서비스 제안이며 치료 처방이 아닙니다."};
  if(r.category==="food")return {ids:r.id==="food-protein"?["protein","diet"]:["diet"],note:"균형·다양성 등 식사 원칙을 참고했습니다. 개별 메뉴·실행 시간은 서비스 제안이며 영양소 결핍 진단이 아닙니다."};
  if(r.category==="move")return {ids:["activity"],note:"움직임·좌식 줄이기의 일반 원칙을 참고했습니다. 이 루틴의 분량이 주간 운동 권고 충족이나 치료 효과를 뜻하지는 않습니다."};
  return {ids:["stress"],note:"스트레스 대처의 일반 원칙을 참고했습니다. 구체적 행동·시간은 서비스 제안이며 심리검사·치료가 아닙니다."};
}
