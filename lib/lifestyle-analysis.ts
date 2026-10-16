import type { Answers, Analysis, AnalysisMetric } from "./model";

export const metricStatus={met:"기준 충족",below:"권고와 차이",unknown:"정보 부족",self:"자기보고",individual:"개별 지침 우선"} as const;
const known=(v:number|null|undefined):v is number=>typeof v==="number"&&Number.isFinite(v);
const individual=(a:Answers)=>a.conditions||a.medicines||a.pregnancy||a.surgery||a.uncertainSafety;
export function activityComparison(a:Answers){
  const complete=known(a.moderateWeeklyMinutes)&&known(a.vigorousWeeklyMinutes);
  const equivalent=complete?a.moderateWeeklyMinutes!+2*a.vigorousWeeklyMinutes!:null;
  return {complete,equivalent};
}
export function analyze(a:Answers):Analysis[]{
  const tailored=individual(a),older=a.age==="65+";
  const sleepStatus:AnalysisMetric["status"]=tailored?"individual":a.sleepHours<7?"below":older&&a.sleepHours>8?"self":"met";
  const sleepReference=older?"65세 이상: 하루 7–8시간 (CDC)":a.age==="50-64"?"연령대 공통 최소 7시간. 61–64세는 7–9시간 (CDC)":"18–60세: 규칙적으로 하루 7시간 이상 (AASM·SRS)";
  const {complete,equivalent}=activityComparison(a);
  const activityStatus:AnalysisMetric["status"]=tailored||a.movementLimit?"individual":!complete?"unknown":equivalent!>=150?"met":"below";
  const strengthStatus:AnalysisMetric["status"]=tailored||a.movementLimit?"individual":!a.strengthAllGroups||a.strengthAllGroups==="unknown"?"unknown":a.strengthDays>=2&&a.strengthAllGroups==="yes"?"met":"below";
  const foodIndividual=tailored||a.diet==="restricted"||a.allergy;
  const foodStatus:AnalysisMetric["status"]=foodIndividual?"individual":!known(a.fruitVegGrams)?"unknown":a.fruitVegGrams>=400?"met":"below";
  return [
    {category:"sleep",label:"수면·회복",status:sleepStatus==="met"?"시간 기준 충족":sleepStatus==="below"?"수면시간 점검":sleepStatus==="individual"?"개별 지침 우선":"수면시간 확인",headline:a.sleepHours<7?"수면시간을 확보할 여지를 찾아요":a.sleepSymptoms.length?"시간과 별개로 수면 불편도 살펴요":"수면시간과 규칙성을 함께 살펴요",observation:`최근 일주일 평균 ${a.sleepHours}시간 · 수면의 질 ${a.sleepQuality}/5`,
      metrics:[{label:"실제 수면시간",value:`${a.sleepHours}시간`,reference:sleepReference,status:sleepStatus},{label:"평일·주말 취침/기상 차이",value:known(a.scheduleShiftHours)?`${a.scheduleShiftHours}시간`:"아직 응답하지 않음",reference:"가능하면 약 1시간 이내로 일정하게 유지 (NIH NHLBI)",status:tailored||a.work==="shift"?"individual":!known(a.scheduleShiftHours)?"unknown":a.scheduleShiftHours<=1?"met":"below"},{label:"수면 불편",value:a.sleepSymptoms.length?`${a.sleepSymptoms.length}개 선택`:"선택한 불편 없음",reference:"자기보고이며 PSQI나 수면질환 검사가 아닙니다.",status:"self"}],
      limitation:"수면시간 기준 충족은 수면의 질이나 건강을 보증하지 않아요. 50–64세 구간은 정확한 나이를 몰라 최소시간만 비교합니다. 교대근무·질환 등에는 개별 조정이 필요하고, 불편이 지속되면 의료진에게 확인하세요.",sources:["sleep","sleepAge","habits","psqi"]},
    {category:"food",label:"식사·영양",status:foodStatus==="met"?"채소·과일 기준 충족":foodStatus==="below"?"채소·과일 점검":foodStatus==="individual"?"개별 지침 우선":"섭취량 확인 필요",headline:"식품의 양·다양성·식행동을 함께 봐요",observation:`채소 ${a.vegetables}일 · 과일 ${a.fruit}일 · 단백질 식품 ${a.protein}일 / 주`,
      metrics:[{label:"하루 채소·과일 합계",value:known(a.fruitVegGrams)?`약 ${a.fruitVegGrams}g`:"아직 응답하지 않음",reference:"WHO: 하루 최소 400g · 전분성 뿌리식품·주스 제외",status:foodStatus},{label:"식품군 다양성",value:`콩 ${known(a.legumeDays)?`${a.legumeDays}일`:"미입력"} · 통곡물 ${known(a.wholegrainDays)?`${a.wholegrainDays}일`:"미입력"} / 주`,reference:"WHO 식사 다양성 원칙·NQ-2021의 평가 영역 참고",status:"self"},{label:"식행동 기록",value:`배달·외식 ${a.takeaway}회 · 가공육 ${known(a.processedMeatDays)?`${a.processedMeatDays}일`:"미입력"} / 주`,reference:"음식 구성·양을 모르므로 횟수만으로 건강/불건강을 판정하지 않음",status:"self"}],
      limitation:"공식 NQ-2021 설문·점수를 적용하지 않았습니다. 영양소별 섭취량·결핍은 판단할 수 없고, 채소·과일 기준 하나로 식사 전체의 적정성을 평가하지 않아요. KDRIs 수치 비교에는 연령·성별·실제 섭취량 등 추가정보가 필요합니다.",sources:["diet","nq","kdri"]},
    {category:"move",label:"움직임",status:activityStatus==="individual"?"개별 지침 우선":!complete?"활동시간 확인 필요":activityStatus==="met"&&strengthStatus==="met"?"주간 권고 충족":"항목별 권고 확인",headline:a.movementLimit?"운동 제한과 안전을 먼저 확인해요":"유산소·근력·좌식을 나누어 살펴요",observation:`평소 운동 주 ${a.exerciseDays}일 × ${a.exerciseMinutes}분 · 앉아 있는 시간 하루 ${a.sitting}시간`,
      metrics:[{label:"주간 유산소 활동",value:complete?`중강도 ${a.moderateWeeklyMinutes}분 + 고강도 ${a.vigorousWeeklyMinutes}분`:"두 강도의 주간 시간 입력 필요",reference:"WHO: 중강도 150–300분 또는 고강도 75–150분, 또는 동등한 조합",status:activityStatus},{label:"중강도 환산 시간",value:complete?`${equivalent}분 / 주`:"계산하지 않음",reference:"중강도 분 + 고강도 분 × 2 · 최소 150분 비교, 가벼운 활동은 환산 제외",status:activityStatus},{label:"주간 근력운동",value:`${a.strengthDays}일 · 주요 근육군 ${a.strengthAllGroups==="yes"?"포함":a.strengthAllGroups==="no"?"미포함":"미확인"}`,reference:"WHO: 주요 근육군을 사용하는 중강도 이상 근력운동 주 2일 이상",status:strengthStatus},{label:"앉아 있는 시간",value:`하루 ${a.sitting}시간`,reference:"WHO: 좌식 줄이기·활동으로 대체. 모든 성인에게 같은 시간 상한은 제시하지 않음",status:"self"}],
      limitation:"WHO 권고는 일반적 비교 기준이며 운동 처방이 아닙니다. 강도별 주간 시간은 일·이동·여가를 포함하고 같은 활동은 한 번만 계산합니다. 근력운동을 유산소와 중복 입력하지 마세요. 기존 운동 응답만 있으면 추정 환산하지 않습니다. GPAQ 공식 점수는 아닙니다.",sources:["activity","gpaq"]},
    {category:"mind",label:"스트레스",status:"주관적 상태 기록",headline:"스트레스와 에너지는 따로 기록해요",observation:`최근 일주일 스트레스 ${a.stress}/5 · 에너지 ${a.energy}/5`,metrics:[{label:"느끼는 스트레스",value:`${a.stress}/5`,reference:"서비스 자체 질문 · 1 낮음, 5 높음 · 임상 위험등급 아님",status:"self"},{label:"느끼는 에너지",value:`${a.energy}/5`,reference:"서비스 자체 질문 · 1 낮음, 5 높음 · 스트레스와 합산하지 않음",status:"self"}],limitation:"PSS-10 원문·점수는 적용하지 않았습니다. PSS 개발자도 공식 진단 절단값을 제시하지 않습니다. 이 기록으로 정신건강 질환이나 위험등급을 판단하지 않아요. 어려움이 지속되거나 일상에 영향을 주면 전문가에게 확인하세요.",sources:["stress","pss"]},
  ];
}
