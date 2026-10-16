import { type Answers, type Checkin, type Day, type Inbody, type Routine, type Schedule, type TimelineItem, toMinutes, toTime, localDate } from "./model";
import { MAX_DAILY_ROUTINES, recommendCore } from "./routine-catalog";

export { analyze } from "./lifestyle-analysis";

export function buildRoutines(a: Answers, c: Checkin, history: Day[] = [], inbody?: Inbody, generation = 0): Routine[] {
  return recommendCore(a, c, history, inbody, generation);
}

export function validateSchedule(s: Schedule): string[] {
  const warnings: string[] = [];
  const wake = toMinutes(s.wake), end = toMinutes(s.bed) <= wake ? toMinutes(s.bed) + 1440 : toMinutes(s.bed);
  if (end - wake > 20 * 60 || end - wake < 6 * 60) warnings.push("기상·취침시간 사이를 확인해주세요. 계획은 깨어 있는 6~20시간 범위에서 만들 수 있어요.");
  const events = s.events.map(e => ({...e,...eventRange(e,s)})).sort((a,b)=>a.from-b.from);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    if (e.from < wake || e.until > end) warnings.push(`${e.title}: 기상부터 취침까지의 시간 안에 넣어주세요.`);
    if (!!e.breakStart !== !!e.breakEnd || (e.breakStart && e.breakEnd && (e.pauseFrom! <= e.from || e.pauseUntil! >= e.until || e.pauseUntil! <= e.pauseFrom!))) warnings.push(`${e.title}: 휴식 시작·종료를 일정 안에 정확히 입력해주세요.`);
  }
  const intervals=events.flatMap(e=>e.pauseFrom!==undefined&&e.pauseUntil!==undefined?[{title:e.title,from:e.from,until:e.pauseFrom},{title:e.title,from:e.pauseUntil,until:e.until}]:[{title:e.title,from:e.from,until:e.until}]).sort((a,b)=>a.from-b.from);
  for(let i=1;i<intervals.length;i++)if(intervals[i-1].until>intervals[i].from)warnings.push(`${intervals[i-1].title}과 ${intervals[i].title} 일정이 겹쳐요.`);
  return warnings;
}

function eventRange(e: Schedule["events"][number], s: Schedule) {
  const wake=toMinutes(s.wake);
  const from=toMinutes(e.start)+(toMinutes(e.start)<wake?1440:0);
  const until=from+((toMinutes(e.end)-toMinutes(e.start)+1440)%1440 || 1440);
  const offset=(t:string)=>from+(toMinutes(t)-toMinutes(e.start)+1440)%1440;
  return {from,until,pauseFrom:e.breakStart?offset(e.breakStart):undefined,pauseUntil:e.breakEnd?offset(e.breakEnd):undefined};
}

export function holdUnsafeRoutines(routines:Routine[], checkin:Checkin, movementLimit=false):Routine[] {
  return routines.map(r=>{
    const held=(checkin.unwell||movementLimit)&&r.category==="move"&&(r.source==="custom"||!["move-recovery","move-rest","move-read","move-posture"].includes(r.id));
    if(held) return {...r,held:true};
    const {held:previous,...rest}=r;return previous===undefined?r:rest;
  });
}

export function buildTimeline(routines: Routine[], s: Schedule): { timeline: TimelineItem[]; warnings: string[] } {
  const errors = validateSchedule(s);
  if (errors.length) return { timeline: [], warnings: errors };
  const wake = toMinutes(s.wake), rawBed = toMinutes(s.bed), bed = rawBed <= wake ? rawBed + 1440 : rawBed;
  const occupied: { start: number; end: number }[] = [];
  const timeline: TimelineItem[] = [];
  const warnings: string[] = [];
  const add = (id: string, title: string, start: number, duration: number, kind: TimelineItem["kind"], detail: string, routineId?: string) => {
    occupied.push({ start, end: start + duration });
    timeline.push({ id, title, start: toTime(start), end: toTime(start + duration), kind, detail, routineId });
  };
  const ranges=s.events.map(e=>({...e,...eventRange(e,s)}));
  ranges.forEach(e=>{
    if(e.pauseFrom!==undefined && e.pauseUntil!==undefined) {
      add(e.id,e.title,e.from,e.pauseFrom-e.from,"fixed","등록한 휴식 전 일정");
      add(`${e.id}-after`,e.title,e.pauseUntil,e.until-e.pauseUntil,"fixed","등록한 휴식 후 일정");
    } else add(e.id,e.title,e.from,e.until-e.from,e.category==="meal"?"meal":"fixed",e.description??"직접 등록한 고정 일정");
  });
  const find = (preferred: number, duration: number, minStart = wake, maxEnd = bed) => {
    for (let delta = 0; delta < bed - wake; delta += 5) {
      for (const start of delta ? [preferred + delta, preferred - delta] : [preferred]) {
        if (start < minStart || start + duration > maxEnd) continue;
        if (occupied.every(o => start + duration + s.buffer <= o.start || start >= o.end + s.buffer)) return start;
      }
    }
    return null;
  };
  const preparation = s.preparation ? find(wake, s.preparation) : null;
  if (preparation !== null) add("preparation", "기상 · 하루 준비", preparation, s.preparation, "rest", "입력한 아침 준비시간을 확보했어요.");
  else if (s.preparation) warnings.push("아침 준비시간을 확보하지 못했어요. 고정 일정을 조정해주세요.");
  const travel=ranges.filter(e=>!["meal","rest"].includes(e.category??""));
  if(s.commute && travel.length) {
    const first=Math.min(...travel.map(e=>e.from)),last=Math.max(...travel.map(e=>e.until));
    for(const [id,title,start] of [["outbound","이동 · 출근",first-s.commute-s.buffer],["inbound","이동 · 귀가",last+s.buffer]] as const) {
      if(start<wake||start+s.commute>bed||occupied.some(o=>start<o.end+s.buffer&&start+s.commute+s.buffer>o.start)) warnings.push(`${title} 시간을 확보하지 못했어요. 고정 일정·준비시간을 조정해주세요.`);
      else add(id,title,start,s.commute,"fixed","고정 일정에 맞춘 편도 이동시간");
    }
  }
  for (const [id, title, value] of [["breakfast", "아침식사", s.breakfast], ["lunch", "점심식사", s.lunch], ["dinner", "저녁식사", s.dinner]]) {
    const target=toMinutes(value)<wake?toMinutes(value)+1440:toMinutes(value);
    if(timeline.some(t=>t.kind==="meal"&&Math.abs((toMinutes(t.start)<wake?toMinutes(t.start)+1440:toMinutes(t.start))-target)<=60))continue;
    const slot = find(target,20,Math.max(wake,target-60),Math.min(bed,target+80));
    if (slot === null) warnings.push(`${title} 시간이 부족해 배치하지 못했어요. 고정 일정을 조정해주세요.`);
    else {
      const preferred = toMinutes(value) < wake ? toMinutes(value) + 1440 : toMinutes(value);
      if (Math.abs(slot - preferred) > 60) warnings.push(`${title}가 희망시간보다 1시간 이상 이동했어요. 업무·수업 중 식사 가능한 시간을 고정 일정 사이에 비워주세요.`);
      add(id, title, slot, 20, "meal", s.cooking ? "가능한 환경에서 균형 있게 먹기" : "외식 메뉴에 채소·단백질 식품이 있는지 확인하기");
    }
  }
  const absolute = (t: string) => toMinutes(t) < wake ? toMinutes(t) + 1440 : toMinutes(t);
  for (const r of routines) {
    if(r.held) continue;
    const mealId=r.id==="food-first"?(r.when.startsWith("저녁")?"dinner":r.when.startsWith("점심")?"lunch":"breakfast"):"lunch";
    const meal=timeline.find(t=>t.id===mealId)??timeline.find(t=>t.kind==="meal"&&Math.abs(absolute(t.start)-absolute(s[mealId]))<=60);
    const afterMeal = meal ? absolute(meal.end) + s.buffer : wake;
    const caffeineEnd = Math.max(wake + 30, bed - 6 * 60);
    const customTime = r.preferredTime ? absolute(r.preferredTime) : undefined;
    const sleepPrep = r.category === "sleep" && r.id !== "sleep-caffeine" && r.source !== "custom";
    const afterFood = r.category === "move" && (r.id === "move-break" || r.id === "move-outside");
    const pref = customTime ?? (r.id === "sleep-caffeine" ? caffeineEnd - 30 : sleepPrep ? bed - 10 : r.category === "food" && meal ? absolute(meal.start) - s.buffer - r.minutes : afterFood ? afterMeal : s.peak === "morning" ? wake + 3 * 60 : s.peak === "afternoon" ? wake + 8 * 60 : bed - 3 * 60);
    const min = customTime !== undefined ? wake : afterFood ? afterMeal : sleepPrep ? Math.max(wake, bed - 60) : wake;
    const max = customTime !== undefined ? bed : r.id === "sleep-caffeine" ? caffeineEnd : r.category === "food" && meal ? absolute(meal.start) : bed;
    const slot = find(Math.min(bed - r.minutes, Math.max(wake, pref)), Math.max(1, r.minutes), min, max);
    if (slot === null) warnings.push(`“${r.title}”를 넣을 시간이 부족해요. 대체 행동을 확인해주세요.`);
    else {
      if(customTime !== undefined && slot !== customTime) warnings.push(`“${r.title}”의 희망시간은 다른 일정과 겹쳐 ${toTime(slot)}로 이동했어요.`);
      const stretching = r.id === "move-break" && s.exercise === "stretch";
      add(`routine-${r.id}`, stretching ? `${r.minutes}분 가벼운 스트레칭` : r.title, slot, Math.max(1, r.minutes), "routine", stretching ? "반동을 주거나 통증을 참지 않고, 편안한 범위에서 몸을 풀어보세요." : r.detail, r.id);
    }
  }
  return { timeline: timeline.sort((a, b) => { const n = (t: string) => toMinutes(t) < wake ? toMinutes(t) + 1440 : toMinutes(t); return n(a.start) - n(b.start); }), warnings };
}

export function reviseDayRoutines(day: Day, routines: Routine[], schedule: Schedule): Day {
  if(routines.length > MAX_DAILY_ROUTINES) throw new Error(`오늘의 루틴은 최대 ${MAX_DAILY_ROUTINES}개까지 담을 수 있어요.`);
  if(new Set(routines.map(r => r.id)).size !== routines.length) throw new Error("이미 담은 루틴이에요.");
  const ids = new Set(routines.map(r => r.id));
  const plan = day.mode === "full" ? buildTimeline(routines,schedule) : {timeline:[],warnings:[]};
  const minutes = routines.filter(r=>!r.held).reduce((n,r) => n+r.minutes,0);
  const budget=day.planningContext?.effectiveMinutes??day.checkin.minutes;
  if(minutes > budget) plan.warnings.push(`담은 루틴은 총 ${minutes}분으로, ${day.planningContext?"하루 계획을 반영한":"선택한"} ${budget}분보다 많아요. 루틴을 줄이거나 가능한 시간을 조정해주세요.`);
  if(routines.some(r=>r.held)) plan.warnings.push("몸 상태·운동 제한에 따라 활동 루틴을 보류했어요. 기존 실천 기록은 유지하고, 보류한 활동은 일정에 넣지 않아요.");
  return {...day,routines,statuses:Object.fromEntries(Object.entries(day.statuses).filter(([id]) => ids.has(id))),notes:Object.fromEntries(Object.entries(day.notes).filter(([id]) => ids.has(id))),...plan};
}

export function buildDay(a: Answers, c: Checkin, mode: "core" | "full", schedule: Schedule, history: Day[] = [], inbody?: Inbody, date = localDate(), refresh = true): Day {
  const previous = history.find(d => d.date === date);
  const generation = previous ? (previous.generation ?? 0) + (refresh ? 1 : 0) : 0;
  const retained = previous?.routines.filter(r => (r.source && r.source !== "auto") || !!previous.statuses[r.id]) ?? [];
  const protectedIds = new Set(retained.map(r => r.id));
  const recommendations = buildRoutines(a,c,history.filter(d => d.date !== date),inbody,generation).filter(r => !protectedIds.has(r.id));
  const routines = !refresh && previous ? previous.routines : [...retained,...recommendations].slice(0,MAX_DAILY_ROUTINES);
  const safe=holdUnsafeRoutines(routines,c,a.movementLimit);
  return reviseDayRoutines({date,routines:safe,checkin:c,generation,mode,statuses:previous?.statuses ?? {},notes:previous?.notes ?? {},timeline:[],warnings:[]},safe,schedule);
}

export type Supplement = { id: string; name: string; subtitle: string; reason: string; food: string; caution: string; label: string; query: string; source: string; blocked: boolean; };
export function supplementGuides(a: Answers): Supplement[] {
  if (!a.supplementOptIn) return [];
  const blocked = a.safetyReviewed!==true || a.conditions || a.medicines || a.pregnancy || a.surgery || a.allergy || a.uncertainSafety || !!a.currentSupplements.trim() || !!a.confirmedDeficiency.trim() || a.age === "65+";
  const guides: Supplement[] = [];
  if (a.diet === "vegan" || a.diet === "vegetarian") guides.push({ id: "b12", name: "비타민 B12", subtitle: "신경 기능 · 적혈구 형성에 필요한 영양소", reason: "채식 식단을 선택하셨어요. B12 급원식품 섭취를 먼저 확인해보세요.", food: "B12 강화식품 및 식단에 허용되는 동물성 식품", caution: "설문으로 결핍을 확정할 수 없어요. 필요한 검사와 보충량은 전문가에게 확인하세요.", label: "식단 기반 정보", query: "vitamin B12", source: "https://ods.od.nih.gov/factsheets/VitaminB12-Consumer/", blocked });
  if (a.dairy < 3) guides.push({ id: "calcium", name: "칼슘", subtitle: "뼈·치아 유지에 필요한 영양소", reason: `우유·유제품 또는 대체식품 섭취가 주 ${a.dairy}일이에요. 섭취량과 강화 여부도 확인해야 해요.`, food: "칼슘 강화 두유, 두부, 식단에 맞는 유제품", caution: "신장질환·결석 병력과 복용약에 따라 주의가 필요해요. 식품과 보충제를 합친 총량을 확인하세요.", label: "식품군 기반 정보", query: "calcium", source: "https://ods.od.nih.gov/factsheets/Calcium-Consumer/", blocked });
  if (a.fish < 2) guides.push({ id: "omega", name: "오메가-3", subtitle: "EPA·DHA 등 지방산 정보", reason: `생선 섭취가 주 ${a.fish}일이에요. 먼저 식품으로 지방산을 섭취할 방법을 살펴보세요.`, food: "식단에 맞는 생선, 견과류·씨앗류", caution: "항응고제·수술 예정·해산물 알레르기는 상담이 필요해요. ALA와 EPA·DHA는 같은 성분이 아니에요.", label: "식품군 기반 정보", query: "omega 3", source: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-Consumer/", blocked });
  if (!guides.length) guides.push({ id: "balance", name: "현재는 식단 균형부터", subtitle: "추가 영양제가 모두에게 필요한 것은 아니에요", reason: "현재 답변에서 특정 제품을 우선 제안할 충분한 근거가 없어요.", food: "다양한 채소·과일·단백질 식품을 규칙적으로 섭취하기", caution: "피로 같은 증상 하나를 특정 영양소 부족으로 연결하지 않아요.", label: "생활습관 우선", query: "", source: "https://ods.od.nih.gov/HealthInformation/ODS_Frequently_Asked_Questions.aspx", blocked: true });
  return guides;
}

export function extractInbody(text: string): Partial<Inbody> {
  const result: Partial<Inbody> = {};
  const read = (labels: string, min: number, max: number) => {
    const m = text.match(new RegExp(`(?:${labels})[^\\d]{0,25}(\\d{1,3}(?:\\.\\d+)?)`, "i"));
    const n = m ? Number(m[1]) : NaN; return n >= min && n <= max ? n : undefined;
  };
  result.height = read("신장|Height", 100, 230); result.weight = read("체중|Weight", 25, 300);
  result.muscle = read("골격근량|Skeletal Muscle Mass|SMM", 5, 100); result.fat = read("체지방률|Percent Body Fat|PBF", 2, 65);
  const bmr = text.match(/(?:기초대사량|Basal Metabolic Rate|BMR)[^\d]{0,25}(\d{3,4})/i);
  if (bmr && +bmr[1] >= 500 && +bmr[1] <= 4000) result.bmr = +bmr[1];
  const date = text.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (date) result.measuredAt = `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`;
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined));
}
