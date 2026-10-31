import type { ActivityDomain } from "./activity-profile";

export type ActivityQuestion={key:string;title:string;why:string;options?:Record<string,string>;type?:"text"|"date"};
const question=(key:string,title:string,why:string,options:Record<string,string>):ActivityQuestion=>({key,title,why,options});
const text=(key:string,title:string,why:string):ActivityQuestion=>({key,title,why,type:"text"});
export const baseActivityQuestions:Record<ActivityDomain,ActivityQuestion[]>={
  exercise:[question("interest","어떤 운동이 끌리나요?","후보를 먼저 보여드리고, 선택한 운동만 더 알아봐요.",{unknown:"추천받기",walk:"걷기",run:"러닝",gym:"헬스",yoga:"요가",home:"홈트레이닝",cycle:"자전거"}),question("place","주로 어디에서 운동할 수 있나요?","이용 가능한 장소에 맞는 후보를 골라요.",{home:"집",outside:"야외",gym:"헬스장",any:"여러 장소"})],
  study:[text("subject","어떤 과목이나 공부를 하고 있나요?","계획표 과목을 선택하거나 적어주세요. 생략하면 ‘선택한 공부’로 안내해요."),{key:"deadline",title:"시험이나 마감이 있나요?",why:"입력한 마감까지 남은 기간을 표시해요. 없으면 비워두세요.",type:"date"},question("progress","지금 어디까지 진행했나요?","기초부터 볼지, 진행 중인 작업을 이어갈지 결정해요.",{start:"시작 전",some:"일부 진행",half:"절반 정도",finish:"마무리",unknown:"잘 모르겠어요"})],
  reading:[question("hasBook","읽고 있는 책이 있나요?","이미 읽던 책이 있으면 새 책부터 고르지 않아도 돼요.",{yes:"있어요",no:"없어요"}),question("genre","어떤 분야를 읽고 싶나요?","관심 분야를 반영해요. 기존 책이 있다면 ‘읽던 책’도 괜찮아요.",{existing:"읽던 책",fiction:"소설",essay:"에세이",human:"인문·사회",science:"과학",economy:"경제·경영",unknown:"추천받기"}),question("format","어떤 독서 방식이 편한가요?","종이책·전자책·오디오북 중 가능한 방식을 사용해요.",{paper:"종이책",ebook:"전자책",audio:"오디오북",any:"모두 괜찮아요"})],
  language:[question("language","어떤 언어를 배우고 있나요?","연습할 언어를 정해요.",{english:"영어",japanese:"일본어",chinese:"중국어",other:"다른 언어"}),question("level","지금 편하게 할 수 있는 것은요?","자가 응답을 참고할 뿐 공인 언어 수준으로 판정하지 않아요.",{start:"처음 시작",sentence:"짧은 문장 이해",talk:"간단한 대화",long:"긴 글·대화 이해",unknown:"잘 모르겠어요"}),question("skill","우선 연습하고 싶은 것은요?","듣기·말하기·읽기·쓰기 후보를 골라요.",{listen:"듣기",speak:"말하기",read:"읽기",write:"쓰기",all:"골고루"})],
  career:[question("field","어떤 분야를 준비하나요?","배우는 분야를 결과물과 연결해요.",{code:"프로그래밍",design:"디자인",write:"글쓰기",certificate:"자격증",job:"취업 준비",other:"다른 분야"}),question("level","지금 어느 정도 할 수 있나요?","안내를 따라 할지, 혼자 작은 작업을 할지 정해요.",{start:"처음",guided:"안내를 따라 가능",solo:"간단한 작업 가능",improve:"기존 작업 개선"}),text("output","만들거나 끝내고 싶은 결과물은요?","프로젝트·포트폴리오·지원서 등을 짧게 적어주세요. 아직 없으면 생략해요."),{key:"deadline",title:"완성해야 할 날짜가 있나요?",why:"마감이 없다면 비워두세요. 실제 작업 분량은 임의로 추정하지 않아요.",type:"date"}],
  rest:[question("place","주로 어디에서 쉬나요?","현재 환경에서 실행할 수 있는 휴식을 골라요.",{home:"집",office:"학교·회사",moving:"이동 중",outside:"야외"}),question("occasion","언제 쉬고 싶나요?","휴식을 넣고 싶은 상황을 확인해요.",{morning:"하루 시작",between:"활동 사이",evening:"하루 마무리",any:"상황마다"})],
  organize:[question("target","어디부터 정리하고 싶나요?","주소나 개인 파일 내용은 필요하지 않아요.",{desk:"책상",room:"방",kitchen:"주방",digital:"휴대폰·파일",todo:"할 일 목록"}),question("problem","지금 가장 불편한 것은요?","불편을 줄이는 작은 행동을 고르는 데 사용해요.",{pile:"물건이 쌓여요",find:"필요한 걸 못 찾아요",files:"파일이 뒤섞여요",forget:"할 일을 잊어요"}),question("scope","이번에는 어느 정도 할까요?","전체 공간을 한 번에 끝내도록 강요하지 않아요.",{few:"물건 몇 개",small:"작은 구역 하나",whole:"한 공간",unknown:"추천받기"})],
};
const experience=question("experience","선택한 운동을 해본 경험이 있나요?","익숙한 운동을 기준으로 분량을 정해요. 모르면 운동 준비 활동으로 바꿀 수 있어요.",{first:"처음이에요",return:"쉬었다가 다시 시작",regular:"현재 하고 있어요",unknown:"잘 모르겠어요"});
const restriction=question("restriction","운동할 때 불편하거나 피해야 할 동작이 있나요?","불편이 있거나 불확실하면 운동 실행 대신 준비 활동을 제안해요. 질병 진단에 쓰지 않아요.",{none:"없어요",impact:"충격이 큰 동작",knee:"무릎을 많이 굽히기",wrist:"손목으로 버티기",other:"그 밖의 불편·여러 동작",unknown:"잘 모르겠어요"});
export type ActivityDefinition={id:string;domain:ActivityDomain;title:string;description:string;goals:string[];category:"move"|"mind"|"sleep";fallback:string;questions:ActivityQuestion[]};
const make=(domain:ActivityDomain,id:string,title:string,description:string,goals:string[],questions:ActivityQuestion[]=[],category:ActivityDefinition["category"]="mind"):ActivityDefinition=>({domain,id,title,description,goals,questions,category,fallback:domain==="exercise"?"운동 실행 대신 장소·준비물만 확인하고 쉬어요.":"자료나 공간을 준비하고 첫 행동 하나만 시작해요."});
const exercise=(id:string,title:string,description:string,goals:string[],extra:ActivityQuestion[]=[])=>make("exercise",id,title,description,goals,[experience,restriction,...extra,question("overhead","이동·준비시간은 얼마나 필요한가요?","활동 시간과 별도로 전체 일정에서 확보할 여유예요.",{"0":"거의 없음","10":"10분","20":"20분","30":"30분"})],"move");
export const activityCatalog:ActivityDefinition[]=[
  exercise("walk","편한 범위에서 걷기","처음과 끝은 천천히 걷고, 중간에는 편안한 속도로 걸어요. 불편하면 멈춰요.",["habit","stamina"]),
  exercise("run","걷기와 러닝 이어가기","처음이면 걷기를 중심으로 시작하고, 익숙한 경우에만 편한 달리기를 섞어요. 속도 경쟁은 하지 않아요.",["stamina"],[question("running","최근 편했던 방식은요?","걷기부터 시작할지 익숙한 달리기를 이어갈지 반영해요.",{first:"경험 없음",walk:"걷기",alternate:"걷기·달리기 번갈아",continuous:"쉬지 않고 달리기"})]),
  exercise("gym","헬스장에서 익숙한 운동하기","처음에는 기구 사용 안내를 받고 익숙한 운동을 고르세요. 사용법을 모르는 기구는 혼자 시작하지 않아요.",["strength"],[question("equipmentSkill","기구 사용법을 알고 있나요?","처음이면 기구 안내를 받는 준비 활동으로 바꿔요.",{yes:"익숙한 기구가 있어요",no:"안내가 필요해요",body:"맨몸 위주로 할게요"})]),
  exercise("yoga","기초 요가 동작 살펴보기","초보자 안내에서 편안하게 할 수 있는 동작만 선택해요. 통증을 참거나 자세를 억지로 유지하지 않아요.",["flexibility"],[question("yogaGuide","어떤 안내가 편한가요?","사용할 동작 안내를 고르는 데 반영해요.",{beginner:"처음부터 자세 안내",familiar:"익숙한 동작 중심",chair:"의자 등 보조도구 활용"})]),
  exercise("home","조용한 홈트레이닝","동작 안내를 보며 익숙하고 불편 없는 맨몸 동작을 골라요. 처음이면 자세 확인부터 해요.",["strength","habit"],[question("equipment","사용 가능한 기구가 있나요?","준비물이 없는 활동도 선택할 수 있어요.",{none:"없어요",mat:"매트",band:"밴드",dumbbell:"덤벨"}),question("noise","뛰는 동작이 가능한 공간인가요?","불가능하면 점프 없는 방식으로 안내해요.",{yes:"가능해요",no:"소음 때문에 어려워요",unknown:"잘 모르겠어요"})]),
  exercise("cycle","익숙한 환경에서 자전거 타기","안전장비와 주변을 확인하고 익숙한 환경에서 편한 속도로 타요. 처음에는 사용법 확인부터 시작해요.",["stamina"]),
  make("exercise","prepare","운동 장소·준비물 확인하기","운동 실행은 보류하고 가능한 장소와 준비물을 확인해요. 불편한 동작과 운동 방법이 불확실하면 먼저 확인하세요.",["unknown"],[],"mind"),
  make("study","concept","개념을 내 말로 정리하기","자료에서 개념 3개를 골라 내 말로 정리하고 모르는 부분을 표시해요.",["understand","memorize","exam"],[text("unit","이번에 다룰 단원이나 주제는요?","생략하면 가지고 있는 자료에서 직접 고르도록 안내해요.")]),
  make("study","problems","문제를 풀고 확인하기","가지고 있는 문제를 풀고 틀렸거나 막힌 부분을 표시해요. 정답을 이해하지 못하면 질문으로 남겨요.",["solve","exam"],[question("material","풀 자료가 있나요?","자료가 없으면 먼저 사용할 자료를 고르는 활동으로 바꿔요.",{yes:"있어요",no:"없어요"})]),
  make("study","assignment","과제 한 부분 완성하기","다음에 끝낼 작은 부분 하나를 정하고 진행한 곳까지 남겨요.",["assignment"],[text("nextTask","다음에 완성할 부분은 무엇인가요?","예: 목차 작성, 자료 하나 정리. 생략하면 작은 부분을 고르는 것부터 시작해요.")]),
  make("study","start","공부의 첫 단계 시작하기","자료를 열고 오늘 할 부분 하나를 정해요. 준비가 되면 가장 작은 작업부터 시작해요.",["start"]),
  make("reading","read","읽던 부분부터 읽기","읽고 싶은 책이나 글을 고르고 정한 시간 동안 읽어요. 페이지 수를 임의로 정하지 않아요.",["habit","fun","knowledge","apply"],[text("book","읽고 있는 책 제목 (선택)","제목과 내용을 자동으로 조회하거나 책의 진도를 추측하지 않아요."),question("record","읽은 뒤 무엇을 남기고 싶나요?","분량 경쟁 대신 원하는 기록 방식을 선택해요.",{none:"읽기만",sentence:"문장 하나",feeling:"짧은 감상",summary:"핵심 내용 정리"})]),
  make("reading","audio","오디오북 이어 듣기","사용 중인 오디오북에서 듣던 부분을 이어 들어요. 집중하기 어려우면 잠시 멈춰요.",["rest","fun"],[text("book","듣고 싶은 책 제목 (선택)","이동 상황과 안전을 우선해요."),question("record","듣고 나서 기록할까요?","원하지 않으면 듣기만 해도 괜찮아요.",{none:"듣기만",feeling:"느낌 한 줄",summary:"내용 한 줄"})]),
  make("language","listen","짧은 음성을 듣고 표현 남기기","선택한 언어의 짧은 자료를 듣고 표현 하나부터 확인해요. 처음이면 한 문장만 반복해도 괜찮아요.",["talk","travel","habit"],[question("material","사용 중인 학습 자료가 있나요?","없으면 자료 하나를 고르는 것부터 시작해요.",{yes:"있어요",no:"없어요"})]),
  make("language","speak","익숙한 표현 소리 내어 말하기","선택한 언어로 오늘 필요한 표현을 골라 말해봐요. 처음이면 짧은 자기소개부터 시작해요.",["talk","travel","work"],[text("topic","어떤 상황에서 쓸 표현인가요? (선택)","예: 여행 주문, 자기소개. 개인정보는 적지 않아도 돼요.")]),
  make("language","text","짧은 글을 읽고 직접 써보기","짧은 자료에서 이해되는 표현을 고르고 자신의 문장으로 다시 적어봐요.",["read","exam","work"],[question("material","사용 중인 교재가 있나요?","교재의 정답·진도를 임의로 만들지 않아요.",{yes:"있어요",no:"없어요"})]),
  make("career","learn","기초 자료 보고 한 번 따라 하기","사용할 자료 하나를 정하고 작은 예제를 따라 해요. 모르는 부분은 질문으로 남겨요.",["basic"]),
  make("career","practice","작은 결과물 직접 만들기","지금 할 수 있는 작은 기능이나 초안 하나를 만들고 결과를 확인해요.",["practice","portfolio"],[text("nextTask","바로 다음에 끝낼 작업 하나는요?","예: 버튼 하나 구현, 화면 스케치, 글의 첫 문단. 생략할 수 있어요.")]),
  make("career","finish","진행 중인 작업 한 부분 마무리하기","완료 기준을 작게 정하고 진행한 부분과 남은 작업을 구분해서 남겨요.",["finish","job","portfolio"],[text("nextTask","오늘 마무리할 부분은요?","지원서·문서의 민감한 내용은 적지 마세요.")]),
  make("rest","quiet","아무것도 더하지 않고 쉬기","편한 자세로 쉬어요. 새로운 할 일을 더하지 않아도 괜찮아요.",["quiet","unknown"],[],"sleep"),
  make("rest","music","취향에 맞는 음악으로 쉬기","편안한 음량으로 직접 고른 음악을 들어요. 방해되면 끄거나 조용한 휴식으로 바꿔요.",["music"],[question("sound","어떤 소리가 편한가요?","취향을 반영하며 집중력·치료 효과를 보장하지 않아요.",{instrumental:"가사 없는 음악",vocal:"보컬 있는 음악",nature:"자연 소리",any:"둘 다 비교"}),question("mood","선호하는 분위기는요?","듣고 싶은 장르 후보를 정해요.",{calm:"차분한",bright:"밝은",familiar:"익숙한",unknown:"추천받기"})],"sleep"),
  make("rest","screen","화면에서 떨어져 잠시 쉬기","화면을 잠시 내려놓고 편한 곳을 바라보며 쉬어요.",["screen"],[],"sleep"),
  make("rest","thought","생각 한 줄 남기고 쉬기","머릿속에 남은 일 하나를 적고 지금 쉬어도 되는지 확인해요.",["thought"],[],"sleep"),
  make("organize","space","작은 구역 하나 정리하기","정리할 범위를 작게 정하고 물건을 제자리에 둬요. 시간이 끝나면 진행한 곳까지만 남겨요.",["space"]),
  make("organize","digital","파일·링크 한 곳에 모으기","필요한 자료 몇 개를 정한 폴더나 보관함에 모아요. 중요한 파일은 확인 없이 삭제하지 않아요.",["digital"]),
  make("organize","todo","다음 행동 하나 정리하기","할 일 목록에서 지금 할 수 있는 행동 하나를 고르고 필요한 준비물을 확인해요.",["todo","start"]),
];
export function activityDefinition(p:{domain:ActivityDomain;activity:string}){return activityCatalog.find(a=>a.domain===p.domain&&a.id===p.activity);}
export function activityCandidates(p:{domain:ActivityDomain;activity:string;goal:string;fields:Record<string,string>}){
  return activityCatalog.filter(a=>a.domain===p.domain).filter(a=>p.domain!=="exercise"||a.id==="prepare"||!(p.fields.place==="home"&&["run","gym","cycle"].includes(a.id))&&!(p.fields.place==="outside"&&["gym","home"].includes(a.id))&&!(p.fields.place==="gym"&&a.id==="home")).sort((a,b)=>{
    const score=(a:ActivityDefinition)=>(a.goals.includes(p.goal)?4:0)+(a.id===p.fields.interest?8:0)+(p.fields.format==="audio"&&a.id==="audio"?10:0)+(p.fields.skill==="speak"&&a.id==="speak"?8:0)+(p.fields.skill==="read"&&a.id==="text"?8:0);
    return score(b)-score(a);
  });
}
export function activityCompatibility(p:{domain:ActivityDomain;activity:string;goal:string;fields:Record<string,string>}):string|null{
  if(!activityCandidates(p).some(a=>a.id===p.activity))return "선택한 장소에 맞는 활동을 다시 골라주세요.";
  if(p.domain==="exercise"&&p.activity!=="prepare"&&(!p.fields.experience||p.fields.experience==="unknown"||p.fields.restriction!=="none"))return "운동 경험·불편한 동작이 미확인이거나 제한이 있어요. 운동 실행 대신 ‘운동 장소·준비물 확인하기’를 선택할 수 있어요.";
  return null;
}
