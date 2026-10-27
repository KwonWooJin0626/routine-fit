import type { Answers, Checkin, Day, Routine } from "./model";

export function growthCatalog():Routine[]{
  const make=(id:string,title:string,detail:string,minutes:number,when:string,fallback:string,category:Routine["category"]="mind"):Routine=>({id:`growth-${id}`,category,title,detail,minutes,when,fallback,reason:"작게 시작하고 실행 기록에 맞춰 분량을 조정하는 자기개발 제안이에요. 건강 상태나 영양소 부족을 진단한 결과는 아니에요.",source:"auto"});
  const rows=[
    make("priority","오늘 중요한 일 한 가지 적기","오늘 마치고 싶은 일 하나를 골라 한 줄로 적어요.",1,"하루 시작","제목만 한 단어로 적기"),
    make("reading","책 한 문단 읽기","지금 읽고 싶은 책에서 한 문단만 읽어요. 많이 읽기보다 시작에 의미를 둬요.",3,"일정 사이","첫 문장만 읽기"),
    make("desk","책상 위 물건 한 개 정리하기","다음 활동을 시작하기 편하게 물건 하나를 제자리에 둬요.",1,"공부·업무 전","물건 하나의 위치만 정하기"),
    make("focus","알림을 잠시 끄고 한 가지 시작하기","지금 할 일 하나를 정하고 5분만 집중해요. 급한 연락은 받을 수 있게 조정해요.",5,"집중하기 편한 시간","필요한 문서나 책만 열기"),
    make("reflect","오늘 해낸 일 하나 남기기","크고 작은 일 중 오늘 해낸 것을 한 줄로 적어요. 못한 일 목록은 잠시 내려놓아요.",1,"하루 마무리","해낸 일 하나 떠올리기"),
    make("rest","아무것도 더하지 않는 짧은 휴식","편한 자세로 잠시 쉬어요. 불편하면 중단하고 나에게 편한 방식으로 바꿔요.",2,"부담이 큰 일정 뒤","잠시 화면에서 시선 떼기","sleep"),
    make("tomorrow","내일 첫 행동 정하기","내일 시작할 일을 아주 작게 정해요. 예: 책 펼치기, 파일 열기.",1,"하루 마무리","첫 행동의 이름만 적기"),
    make("learn-word","새로운 개념 한 가지 정리하기","오늘 배운 개념 하나를 내 말로 한 문장 적어요.",3,"공부·업무 뒤","키워드 하나만 적기"),
    make("review-note","어제 메모 한 줄 다시 읽기","다시 보고 싶은 메모 하나를 골라 읽고 필요한 부분만 표시해요.",2,"집중 활동 전","메모 제목만 확인하기"),
    make("question","모르는 것 한 가지 적어두기","지금 해결하지 않아도 괜찮아요. 다음에 찾아볼 질문을 남겨요.",1,"학습 중간","궁금한 단어 하나 남기기"),
    make("practice","익히고 싶은 기술 5분 연습하기","언어·코딩·악기 등 원하는 기술의 가장 작은 연습을 골라요.",5,"일정 사이","연습 자료만 열기"),
    make("reading-essay","짧은 에세이 한 쪽 읽기","지금 편하게 읽히는 주제의 글을 골라 천천히 읽어요.",5,"쉬어가는 시간","첫 문단만 읽기"),
    make("reading-note","읽은 내용에서 문장 하나 남기기","직접 쓴 요약 한 문장이나 개인 메모를 남겨요.",2,"독서 뒤","느낀 점 한 단어 적기"),
    make("reading-fiction","소설 한 장면 읽기","이어서 읽고 싶은 부분을 골라요. 정한 분량을 채울 필요는 없어요.",5,"저녁 일정 사이","한 문장만 읽기"),
    make("bag","다음 일정에 필요한 물건 확인하기","가방·문서·준비물 중 필요한 것 한 가지를 미리 확인해요.",2,"외출·일정 전","준비물 이름 하나 적기"),
    make("inbox","나중에 볼 자료 한 곳에 모으기","흩어진 링크나 메모 하나를 정한 보관함에 넣어요.",2,"업무·학습 마무리","자료 하나만 저장하기"),
    make("small-task","미뤄둔 일의 첫 단계만 하기","전체 일을 끝내려 하지 않고 시작할 수 있는 행동 하나만 해요.",3,"여유가 있는 시간","첫 단계의 이름만 정하기"),
    make("thanks","고마웠던 순간 하나 떠올리기","사소한 순간이어도 좋아요. 글을 쓰지 않고 생각만 해도 괜찮아요.",1,"하루 마무리","한 단어로 떠올리기"),
    make("pause-screen","화면에서 잠깐 시선 떼기","주변을 편하게 바라보고 지금 쉬어도 되는지 살펴요.",1,"화면 작업 사이","잠시 눈길 돌리기","sleep"),
    make("music-piano","편한 피아노 연주 한 곡 듣기","좋아하는 곡의 일부만 들어도 좋아요. 편안한 음량으로 선택해요.",3,"쉬어가는 시간","곡 하나만 골라두기"),
    make("music-lofi","가사 없는 로파이 한 곡 골라 듣기","배경 음악이 방해되면 끄거나 다른 장르로 바꿔요.",3,"단순 작업 전후","곡의 첫 부분만 듣기"),
    make("music-jazz","어쿠스틱·잔잔한 재즈 들어보기","지금 취향에 맞는 연주를 고르고 불편하면 멈춰요.",3,"저녁 쉬는 시간","플레이리스트 하나 골라두기"),
    make("music-ambient","앰비언트 음악으로 잠깐 쉬기","듣기 편한 소리를 골라요. 수면 치료나 집중력 향상을 보장하는 제안은 아니에요.",3,"휴식 시간","음악 없이 조용히 쉬기","sleep"),
  ];
  return rows.map(r=>r.id.includes("music")?{...r,guidance:{kind:"music" as const,heading:"어떤 장르를 고를까요?",intro:"장르와 분량은 취향에 따른 서비스 제안이에요.",items:r.id.includes("piano")?[{name:"솔로 피아노·네오클래식",note:"잔잔한 연주곡 중 직접 들어보고 편한 곡을 골라요."}]:r.id.includes("lofi")?[{name:"로파이 힙합·칠합",note:"가사가 적은 곡을 원할 때 비교해요. 방해되면 음악을 끄세요."}]:r.id.includes("jazz")?[{name:"어쿠스틱·쿨 재즈",note:"소리와 리듬이 편한 곡으로 선택해요."}]:[{name:"앰비언트·자연음",note:"취향에 맞는 소리나 조용한 휴식을 선택해요."}],caution:"치료나 건강 개선 효과를 보장하지 않아요. 편한 음량으로 들어요.",sources:[{label:"NIH NCCIH · Music and Health",url:"https://www.nccih.nih.gov/health/music-and-health-what-you-need-to-know"}]}}:r.id.includes("reading")?{...r,guidance:{kind:"reading" as const,heading:"읽을거리 고르기",intro:"분야·시간은 서비스 자체 제안이에요.",items:[{name:r.id.includes("essay")?"짧은 에세이":r.id.includes("fiction")?"소설·단편":r.id.includes("note")?"오늘 읽은 글·개인 메모":"관심 있는 책·짧은 글",note:"지금 읽고 싶은 내용으로 바꿔도 괜찮아요."}],caution:"독서 분량을 성과나 건강 점수로 평가하지 않아요.",sources:[]}}:r);
}
export function recommendGrowth(a:Answers,c:Checkin,history:Day[],generation:number):Routine[]{
  const catalog=growthCatalog();
  const completed=history.slice(-7).flatMap(d=>d.routines.filter(r=>d.statuses[r.id]==="skipped"));
  const low=c.energy<=2||c.stress>=4||c.unwell||(c.sleepKnown!==false&&c.sleep<6)||(c.sleepKnown===false&&["under3","3-5"].includes(a.basic?.sleepRange??""))||c.sleepQuality==="poor"||c.busy||(c.studyMinutes??0)>=240||(c.exerciseMinutes??0)>=60;
  const goal=a.basic?.growthGoal;
  const ids=low?["rest","priority","reflect"]:goal==="reading"?["reading","priority","reflect"]:goal==="study"?["focus","desk","reflect"]:goal==="organize"?["desk","priority","tomorrow"]:goal==="recovery"?["rest","reflect","tomorrow"]:a.basic?.sittingRange==="over8"?["priority","pause-screen","reflect"]:a.basic?.exerciseRange==="none"?["priority","rest","reflect"]:generation%2?["reading","desk","reflect"]:["priority","reading","reflect"];
  let budget=Math.min(c.minutes,low?5:10);
  return ids.map(id=>catalog.find(r=>r.id===`growth-${id}`)!).filter(r=>{
    if(completed.filter(x=>x.id===r.id).length>=3&&r.minutes>2)return false;
    if(r.minutes>budget)return false;budget-=r.minutes;return true;
  }).map(r=>({...r,when:["growth-focus","growth-reading"].includes(r.id)&&a.basic?.focusTime&&a.basic.focusTime!=="unknown"?{morning:"오전 일정 사이",afternoon:"오후 일정 사이",evening:"저녁 일정 사이"}[a.basic.focusTime]:a.barrier==="forget"&&r.id==="growth-priority"?"하루 첫 일정 확인 직후":r.when,reason:`${r.reason} ${low?"오늘의 컨디션·예정 활동을 고려해 짧은 실천을 우선했어요.":"선택한 관심 목표와 가능한 시간을 참고했어요."}`.slice(0,300)}));
}
