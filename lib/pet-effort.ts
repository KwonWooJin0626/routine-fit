import { localDate } from "./model";
import { addDate } from "./planner";
import { executionSegments } from "./pet-execution";
import type { PetCommand,PetDocument,PetExecution,PetResult } from "./pet-model";

function minutesOn(r:PetExecution,date:string){
  const start=Date.parse(`${date}T00:00:00+09:00`),end=Date.parse(`${addDate(date,1)}T00:00:00+09:00`);
  return executionSegments(r).reduce((n,s)=>n+Math.max(0,Math.min(s.end,end)-Math.max(s.start,start))/60000,0);
}
export function petEffortSummary(doc:PetDocument,date=localDate(),now=new Date()){
  const rows=doc.records.filter(r=>!r.cancelled&&Date.parse(r.end)<=now.getTime());
  const today=rows.filter(r=>localDate(new Date(r.end))===date);
  const sum=(types:string[],dates:string[])=>Math.round(rows.filter(r=>types.includes(r.type)).reduce((n,r)=>n+dates.reduce((m,d)=>m+minutesOn(r,d),0),0));
  const days=(end:string)=>Array.from({length:7},(_,i)=>addDate(end,-i));
  const current=days(date),previous=days(addDate(date,-7));
  const recordDays=(dates:string[])=>dates.filter(d=>rows.some(r=>localDate(new Date(r.end))===d||minutesOn(r,d)>0)).length;
  const currentDays=recordDays(current),previousDays=recordDays(previous);
  const focus=sum(["study","growth"],[date]),movement=sum(["exercise"],[date]),rest=sum(["rest","leisure"],[date]),work=sum(["work"],[date]);
  const enoughHistory=Date.parse(doc.adoptedAt)<=Date.parse(`${previous.at(-1)}T00:00:00+09:00`)&&Date.parse(doc.seed.at)<=Date.parse(`${previous.at(-1)}T00:00:00+09:00`);
  const comparison=!enoughHistory?"첫 기록부터 차근차근 쌓고 있어요. 2주 기록이 쌓이면 이전 기간과 비교해요.":currentDays>previousDays?`최근 7일은 이전 7일보다 ${currentDays-previousDays}일 더 기록했어요.`:`최근 7일 중 ${currentDays}일에 실천을 기록했어요. 나의 속도로 이어가요.`;
  const message=focus&&rest?"집중과 휴식을 함께 챙겼어요.":movement?"몸을 움직인 시간을 쌓았어요.":work?"해야 할 일을 해냈어요. 이제 회복할 시간도 챙겨요.":today.length?"오늘의 작은 실천이 기록에 남았어요.":"오늘은 하나만 같이 해볼까요?";
  const badges=[...(rows.length?["첫 실천"]:[]),...(currentDays>=3?["한 주에 3일 기록"]:[]),...(focus&&rest?["집중과 쉼"]:[])];
  return {activities:today.length,done:today.filter(r=>r.status==="done").length,partial:today.filter(r=>r.status==="partial").length,focus,movement,rest,work,currentDays,previousDays,comparison,message,badges};
}

export function petCompletionMessage(command:PetCommand,result:PetResult){
  if(result.duplicate)return "이미 반영한 기록이에요. 성장과 시간을 중복 반영하지 않았어요.";
  if(command.action==="cancel")return command.replacementStatus?"미진행으로 바꾸고 연결된 성장도 다시 계산했어요. 다음에 다시 시작해도 괜찮아요.":"완료를 취소하고 연결된 일정·루틴·성장을 다시 계산했어요.";
  if(command.action==="edit")return "실제 수행을 수정하고 이후 상태와 성장을 다시 계산했어요.";
  if(command.action!=="record")return command.action==="adopt"?"새 친구가 오늘의 루틴에 찾아왔어요!":"강아지 설정을 저장했어요.";
  if(command.record.linkTo)return "같은 실제 활동으로 연결했어요. 시간과 성장은 한 번만 반영해요.";
  const record=result.document?.records.find(r=>r.sources.some(s=>s.kind===command.record.source.kind&&s.id===command.record.source.id&&s.date===command.record.source.date)&&!r.cancelled);
  const effect=result.view?.changes.find(e=>e.id===record?.id),rewards=[];
  if(effect?.fitnessXP)rewards.push(`운동 +${Math.round(effect.fitnessXP*10)/10} XP`);
  if(effect?.learningXP)rewards.push(`학습 +${Math.round(effect.learningXP*10)/10} XP`);
  if(effect&&effect.stamina>0)rewards.push(`체력 +${Math.round(effect.stamina*10)/10}`);
  if(effect&&effect.stress<0)rewards.push(`스트레스 ${Math.round(effect.stress*10)/10}`);
  if(command.record.type==="meal")rewards.push(`포만감 ${command.record.fullness}로 기록`);
  const praise=command.record.status==="partial"?"일부라도 해낸 시간을 쌓았어요!":command.record.type==="work"?"해야 할 일을 해냈어요! 이제 잠깐 쉬어도 좋아요.":command.record.type==="none"?"일상을 챙긴 작은 실천도 소중해요!":"작은 실천 하나를 해냈어요!";
  return [praise,...rewards].join(" · ");
}
