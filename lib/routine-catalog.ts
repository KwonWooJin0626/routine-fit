import type { Answers, Checkin, Day, Inbody, Routine } from "./model";
import { guidanceForRoutine } from "./routine-guidance";

export const MAX_DAILY_ROUTINES = 20;
export const routineSourceLabel = (r: Routine) => r.source === "custom" ? "직접 만든 루틴" : r.source === "catalog" ? "내가 고른 루틴" : "컨디션 맞춤";

export function conditionSummary(c: Checkin): string {
  const places = {home:"집",office:"회사·학교",outside:"야외",gym:"운동시설"};
  return `수면 ${c.sleep}시간 · 에너지 ${c.energy}/5 · 스트레스 ${c.stress}/5 · ${c.minutes}분 · ${places[c.place]}${c.busy ? " · 바쁜 날" : ""}${c.unwell ? " · 회복 우선" : ""}`;
}

export function getRoutineCatalog(a: Answers, c: Checkin, inbody?: Inbody): Routine[] {
  const gentle = c.busy || c.energy <= 2 || c.sleep < 6 || c.sleepQuality === "poor" || (c.sleepOpportunity != null && c.sleepOpportunity < 6);
  const movement = Math.max(1, Math.min(c.minutes - 4, gentle ? 5 : Math.round(5 + c.energy * 2)));
  const why = `오늘 입력한 ${conditionSummary(c)}에 맞춰 선택할 수 있는 행동이에요.`;
  const r = (id: string, category: Routine["category"], title: string, detail: string, minutes: number, when: string, reason = why, fallback = "시간을 줄여 가능한 만큼만 실천하기"): Routine => ({id,category,title,detail,minutes,when,reason,fallback,source:"auto"});
  const rows = [
    r("sleep-winddown","sleep",a.work === "shift" ? "다음 수면 전, 화면에서 잠깐 쉬기" : "잠들기 전, 화면에서 잠깐 쉬기","휴대전화를 내려놓고 잠들 준비를 시작해요.",1,"취침 전",`어젯밤 수면 ${c.sleep}시간을 참고해 오늘의 마무리를 제안해요.`),
    r("sleep-light","sleep","잠들기 전 조명 한 단계 낮추기","휴식할 공간의 밝기를 편안하게 조절해요.",1,"취침 전"),
    r("sleep-phone","sleep","휴대전화를 침대에서 떨어진 곳에 두기","알람이 필요하다면 들리는 안전한 위치에 두세요.",1,"취침 전"),
    r("sleep-time","sleep","오늘 잠들 준비를 시작할 시간 정하기","고정 일정에 맞춰 무리하지 않는 취침 준비 시간을 정해요.",1,"저녁"),
    r("sleep-room","sleep","잠자리 주변을 간단히 정리하기","누울 공간의 불필요한 물건 한두 개만 정리해요.",2,"취침 전"),
    r("sleep-caffeine","sleep","늦은 카페인 대신 카페인 없는 음료 고르기","마지막 카페인 섭취시간을 확인하고 다음 음료를 골라요.",1,"오후",`평소 마지막 카페인이 ${a.caffeineTime}예요. 오늘 수면과 함께 참고했어요.`),
    r("food-first","food","거르던 식사에 간단한 한 끼 준비하기","식이 제한·알레르기에 맞춰 다음 식사를 미리 생각해요.",1,"첫 식사 전"),
    r("food-color","food","한 끼에 채소 한 가지 더하기","가능한 식사 한 번에 채소가 있는지 살펴보세요.",1,"점심 또는 저녁",`평소 채소 섭취 주 ${a.vegetables}일을 참고했어요.`),
    r("food-protein","food","다음 식사에 단백질 식품이 있는지 확인하기","음식·섭취 프로필과 실제 원료를 확인하고 먹을 수 있는 식품을 골라요.",1,"식사 전"),
    r("food-menu","food","바쁜 날에도 먹을 수 있는 메뉴 하나 정하기","주변에서 구할 수 있고 식이 제한에 맞는 메뉴를 정해요.",1,"식사 전"),
    r("food-fruit","food","다음 간식으로 먹을 과일 한 가지 정하기","식이 제한에 맞는 식품을 골라 미리 준비해요.",2,"간식 전"),
    r("food-table","food","식사할 때 화면을 잠깐 내려놓기","식사 한 번만 화면 대신 먹는 시간에 집중해요.",1,"식사 전"),
    r("food-label","food","자주 먹는 식품의 영양표시 살펴보기","1회 제공량과 내가 먹는 양을 비교해요. 숫자만으로 좋고 나쁨을 판단하지 않아요.",2,"장보기 전"),
    r("food-plan","food","내일 첫 식사를 미리 생각해두기","거르지 않도록 먹을 수 있는 시간과 메뉴를 메모해요.",1,"저녁"),
    r("move-break","move",`${c.place === "office" ? "회사·학교에서" : c.place === "home" ? "집 주변에서" : c.place === "gym" ? "운동시설에서" : "야외에서"} ${movement}분 편하게 걷기`,"말을 이어갈 수 있는 편한 속도로 시작하고, 불편하면 멈추세요.",movement,"식사 후",inbody ? `${why} 체성분은 ${inbody.measuredAt} 기록을 참고하며 운동 강도 처방에는 사용하지 않아요.` : why,"가능한 곳에서 1분 가볍게 움직이기"),
    r("move-stretch","move",`${Math.min(movement,5)}분, 편안한 범위에서 몸 풀기`,"반동을 주거나 통증을 참지 않고 편안하게 움직여요.",Math.min(movement,5),"쉬는 시간"),
    r("move-desk","move","앉아 있던 자리에서 잠깐 일어나기","넘어질 위험이 없는 곳에서 편안하게 자세를 바꿔요.",1,"오래 앉아 있은 뒤"),
    r("move-room","move",`실내에서 ${Math.min(movement,3)}분 천천히 움직이기`,"안전한 실내 공간에서 편안한 속도로 이동해요.",Math.min(movement,3),"쉬는 시간"),
    r("move-outside","move",`안전한 길에서 ${movement}분 가볍게 산책하기`,"날씨·공기 상태와 이동 경로를 확인하고 무리하지 않아요.",movement,"식사 후"),
    r("move-posture","move","화면 높이와 앉은 자세 확인하기","편한 자세로 바꾸고 같은 자세를 오래 유지하지 않아요.",1,"회사·학교에서"),
    r("move-recovery","move","오늘은 편안하게 쉬며 몸 상태 확인하기","새롭거나 심한 증상, 계속되는 불편은 의료진에게 확인하세요.",1,"편한 시간","오늘의 몸 상태 또는 운동 제한 응답을 반영했어요."),
    r("move-rest","move","무리한 활동 대신 휴식 시간 확보하기","오늘 해야 할 활동 중 줄일 수 있는 것을 하나 정해요.",1,"편한 시간"),
    r("mind-pause","mind","1분 동안 편안하게 호흡하기","숨을 참거나 억지로 깊게 쉬지 말고 평소 호흡에 집중해요.",1,"쉬는 시간"),
    r("mind-screen","mind","1분 동안 화면에서 눈 떼고 쉬기","화면을 잠시 내려놓고 편안하게 쉬어요.",1,"쉬는 시간"),
    r("mind-note","mind","지금 신경 쓰이는 일 한 가지 적기","해결하려 애쓰기보다 짧게 적고 오늘 할 수 있는 한 가지만 정해요.",1,"오후 잠깐"),
    r("mind-priority","mind","오늘 꼭 필요한 일 하나만 정하기","바쁜 날에는 나머지 일을 줄일 수 있는지 살펴봐요.",1,"하루 시작 전"),
    r("mind-music","mind","좋아하는 음악 들으며 잠깐 쉬기","주변의 안전을 확인하고 편안한 음량으로 쉬어요.",3,"쉬는 시간"),
    r("mind-good","mind","오늘 괜찮았던 순간 한 줄 남기기","아주 사소한 순간 하나여도 충분해요.",1,"저녁"),
    r("mind-break","mind","2분 동안 아무 일도 하지 않고 쉬기","편한 자세에서 짧은 휴식 시간을 확보해요.",2,"쉬는 시간"),
    r("mind-connect","mind","편한 사람에게 짧은 안부 전하기","부담 없는 짧은 메시지로 소식을 나눠요.",2,"편한 시간"),
    r("sleep-read","sleep","잠들기 전 5분 편한 글 읽기","종이책의 에세이·시처럼 편한 글을 읽고 졸리면 마무리해요.",5,"취침 전"),
    r("sleep-music","sleep","잔잔한 연주곡 들으며 잠들 준비하기","앰비언트·솔로 피아노·느린 클래식 중 내게 편한 곡을 골라요.",3,"취침 전"),
    r("food-read","food","식사 준비 전 영양정보 한 문단 읽기","영양표시 안내나 간단한 채소·콩 요리 글을 잠깐 읽어요.",2,"식사 전"),
    r("food-music","food","잔잔한 음악과 함께 식사 준비하기","보사노바·어쿠스틱·재즈 연주곡을 조리에 방해되지 않는 음량으로 들어요.",3,"식사 전"),
    r("move-read","move","움직이기 전 안전수칙 잠깐 읽기","앉거나 멈춘 상태에서 안전수칙·산책길 안내를 읽어요. 걸으면서 읽지 않아요.",2,"활동 전"),
    r("move-music","move",`${Math.min(movement,5)}분, 음악과 가볍게 실내 움직이기`,"밝은 팝·펑크·인디 팝을 곁들여 안전한 실내에서 내 속도로 움직여요.",Math.min(movement,5),"쉬는 시간"),
    r("mind-read","mind","쉬는 시간 5분 좋아하는 책 읽기","소설·여행 에세이·시집 중 부담 없는 분량을 골라요.",5,"쉬는 시간"),
    r("mind-focus-read","mind","짧은 글 읽고 기억할 문장 한 줄 남기기","교양서나 짧은 비문학 글에서 관심 있는 내용을 읽고 메모해요.",4,"쉬는 시간"),
    r("mind-music-bright","mind","밝은 음악 한 곡으로 쉬어가기","인디 팝·시티팝·소울·좋아하는 K-pop 중 오늘 듣고 싶은 곡을 골라요.",3,"쉬는 시간"),
  ];
  return rows.filter(item => {
    if(item.id === "sleep-caffeine" && !a.caffeine) return false;
    if(item.category === "move") {
      const recovery = ["move-recovery","move-rest"].includes(item.id);
      if(c.unwell || a.movementLimit) return recovery;
      if(recovery) return false;
      if(item.id === "move-outside") return c.place === "outside";
      if(item.id === "move-posture" || item.id === "move-desk") return c.place === "office" || c.place === "home";
      if(item.id === "move-music") return c.place === "home" || c.place === "gym";
    }
    return true;
  }).map(item=>({...item,guidance:guidanceForRoutine(item,a)}));
}

export function recommendCore(a: Answers, c: Checkin, history: Day[] = [], inbody?: Inbody, generation = 0): Routine[] {
  const tracked = history.slice(-7).filter(d => Object.keys(d.statuses).length).flatMap(d => d.routines.map(r => d.statuses[r.id] ?? "pending"));
  const adherence = tracked.length ? tracked.filter(s => s === "done").length / tracked.length : 1;
  const gentle = c.busy || c.energy <= 2 || c.sleep < 6 || c.unwell || adherence < .4 || c.sleepQuality === "poor" || (c.sleepOpportunity != null && c.sleepOpportunity < 6);
  const catalog = getRoutineCatalog(a,c,inbody);
  const pick = (ids: string[]) => {const candidates = ids.map(id => catalog.find(r => r.id === id)).filter((r):r is Routine => !!r);return candidates[generation % candidates.length];};
  const rows: Routine[] = [];
  rows.push(pick(c.sleep < 7 ? ["sleep-winddown","sleep-light","sleep-phone","sleep-read","sleep-music"] : ["sleep-winddown","sleep-time","sleep-room","sleep-light","sleep-read","sleep-music"]));
  const vegetableGap=typeof a.fruitVegGrams==="number"&&a.fruitVegGrams<400&&!a.conditions&&!a.pregnancy&&!a.allergy&&a.diet!=="restricted";
  const vegetableMet=typeof a.fruitVegGrams==="number"&&a.fruitVegGrams>=400;
  rows.push(pick(a.skip !== "none" ? ["food-first","food-menu","food-plan"] : vegetableGap?["food-color","food-fruit","food-menu"]:c.busy ? ["food-menu","food-protein",vegetableMet?"food-label":"food-color"] : vegetableMet?["food-protein","food-label","food-menu","food-read","food-music"]:["food-color","food-protein","food-table","food-label","food-read","food-music"]));
  rows.push(pick(c.unwell || a.movementLimit ? ["move-recovery","move-rest"] : c.place === "office" ? ["move-break","move-desk","move-posture","move-stretch","move-read"] : c.place === "home" ? ["move-break","move-stretch","move-room","move-read","move-music"] : c.place === "outside" ? ["move-break","move-outside","move-stretch","move-read"] : ["move-break","move-stretch","move-room","move-read","move-music"]));
  const mind=pick(c.stress >= 4 ? ["mind-pause","mind-note","mind-break","mind-read","mind-music"] : ["mind-pause","mind-good","mind-screen","mind-connect","mind-focus-read","mind-music-bright"]);
  if(!gentle && c.minutes >= 10) rows.push(mind);
  if(!gentle && c.minutes >= 15 && a.caffeine > 0 && Number(a.caffeineTime.slice(0,2)) >= 15) rows.push(catalog.find(r => r.id === "sleep-caffeine")!);
  else if(!gentle && c.minutes >= 20) rows.push(pick(c.stress >= 4 ? ["mind-screen","mind-good","mind-priority"] : ["food-plan","food-fruit","food-menu"]));
  const activeAlready=(a.moderateWeeklyMinutes??0)+2*(a.vigorousWeeklyMinutes??0)>=150 || (a.exerciseIntensity!=="light"&&a.exerciseDays*a.exerciseMinutes>=150);
  if((activeAlready||c.exerciseType==="strength"||c.exerciseType==="cardio")&&!c.unwell&&!a.movementLimit) rows[2]={...pick(["move-stretch","move-posture","move-desk"]),reason:"평소 활동 또는 오늘 예정된 운동을 고려해 추가 운동량보다 짧은 몸 풀기·자세 전환을 제안해요."};
  if(a.goal==="stress") { if(!rows.some(r=>r.category==="mind")) rows[0]=mind; rows.sort((x,y)=>Number(y.category==="mind")-Number(x.category==="mind")); }
  else if(a.goal==="fitness") rows.sort((x,y)=>Number(y.category==="move")-Number(x.category==="move"));
  else if(a.goal==="food") rows.sort((x,y)=>Number(y.category==="food")-Number(x.category==="food"));
  else if(a.goal==="energy") rows[0]=pick(["sleep-time","sleep-light","sleep-winddown"]);
  if(a.skip!=="none") {const first=rows.find(r=>r.id==="food-first");if(first)first.when=`${{breakfast:"아침",lunch:"점심",dinner:"저녁"}[a.skip]} 식사 전`;}
  // Fit goal-prioritized safe equivalents to the user's actual time budget.
  let budget = c.minutes;
  return rows.map((item,index) => {
    const minutes = Math.max(1,Math.min(item.minutes,gentle && item.category === "move" ? 5 : 120,budget - (rows.length - index - 1)));
    budget -= minutes;
    const title = item.title.replace(/^\d+분/,`${minutes}분`).replace(/ \d+분 /,` ${minutes}분 `);
    return {...item,guidance:undefined,title,minutes,reason:`${item.reason} 현재 입력: ${conditionSummary(c)}${adherence < .4 ? " · 최근 미실천을 참고해 작게 시작해요." : ""}`.slice(0,300)};
  });
}
