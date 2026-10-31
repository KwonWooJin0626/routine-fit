import { z } from "zod";
import { activityCompatibility, activityDefinition, baseActivityQuestions } from "./activity-catalog";

export const activityDomains = {exercise:"운동",study:"학업·공부",reading:"독서",language:"외국어",career:"기술·커리어",rest:"휴식·음악",organize:"생활 정리"} as const;
export const domainIds = ["exercise","study","reading","language","career","rest","organize"] as const;
export type ActivityDomain = typeof domainIds[number];
export const activityGoals:Record<ActivityDomain,Record<string,string>>={
  exercise:{habit:"운동 습관",stamina:"체력 기르기",strength:"근력 기르기",flexibility:"편안한 움직임",unknown:"추천받기"},
  study:{understand:"개념 이해",memorize:"암기",solve:"문제 풀이",exam:"시험 준비",assignment:"과제 완성",start:"공부 시작하기"},
  reading:{habit:"독서 습관",fun:"즐거움",rest:"마음 쉬기",knowledge:"지식 얻기",apply:"공부·업무 활용"},
  language:{talk:"일상 회화",travel:"여행",exam:"시험",read:"독해",work:"업무",habit:"습관 만들기"},
  career:{basic:"기초 배우기",practice:"직접 만들어보기",finish:"작업 완성",portfolio:"포트폴리오",job:"취업 준비"},
  rest:{quiet:"조용히 쉬기",music:"음악 듣기",screen:"화면에서 벗어나기",thought:"생각 정리",unknown:"추천받기"},
  organize:{space:"공간 정리",digital:"디지털 정리",todo:"할 일 관리",start:"미뤄둔 일 시작"},
};
export const activityWhen={morning:"하루 시작",afterMeal:"식사 후",beforeStudy:"공부·업무 전",between:"활동 사이",evening:"하루 마무리",calendar:"계획표 빈 시간에 배치"} as const;
export const activityFeedbackSchema=z.object({
  reason:z.enum(["okay","time","hard","dislike","environment","condition","other"]).optional(),
  actualMinutes:z.number().int().min(0).max(240).nullable(),recordedAt:z.string().datetime(),
});
export type ActivityFeedback=z.infer<typeof activityFeedbackSchema>;
export const activityProfileSchema=z.object({
  domain:z.enum(domainIds),enabled:z.boolean(),goal:z.string().max(30),
  current:z.enum(["none","sometimes","regular","unknown","profile"]),
  daily:z.number().int().min(5).max(120),weekly:z.number().int().min(5).max(840).nullable(),
  dailySource:z.enum(["self","proposal"]),weeklySource:z.enum(["self","planner","proposal","none"]),
  fields:z.record(z.string().max(30),z.string().trim().max(120)).refine(v=>Object.keys(v).length<=24,"추가 답변이 너무 많아요."),
  activity:z.string().max(40),days:z.array(z.number().int().min(0).max(6)).min(1).max(7),when:z.enum(["morning","afterMeal","beforeStudy","between","evening","calendar"]),
  updatedAt:z.string().datetime(),
}).superRefine((v,c)=>{
  if(!(Object.hasOwn(activityGoals[v.domain],v.goal)))c.addIssue({code:"custom",message:"분야에 맞는 목표를 선택해주세요."});
  if(new Set(v.days).size!==v.days.length)c.addIssue({code:"custom",message:"요일이 중복됐어요."});
  if(v.weekly!==null&&(v.weekly>v.daily*v.days.length||v.weekly<5*v.days.length))c.addIssue({code:"custom",message:"주간 목표를 선택한 요일에 나눌 수 없어요. 하루 시간·주간 목표·요일을 조정해주세요."});
  if(v.domain==="exercise"&&v.activity!=="prepare"&&(!v.fields.experience||v.fields.experience==="unknown"||v.fields.restriction!=="none"))c.addIssue({code:"custom",message:"운동 경험·불편한 동작을 확인하거나 운동 준비 활동으로 바꿔주세요."});
  const compatibility=activityCompatibility(v);if(compatibility)c.addIssue({code:"custom",message:compatibility});
  for(const q of [...baseActivityQuestions[v.domain],...(activityDefinition(v)?.questions??[])]){
    if(q.options&&!(Object.hasOwn(q.options,v.fields[q.key])))c.addIssue({code:"custom",message:`‘${q.title}’의 답변을 선택해주세요.`});
    if(q.type==="date"&&v.fields[q.key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.fields[q.key])||Number.isNaN(new Date(`${v.fields[q.key]}T12:00Z`).getTime())||new Date(`${v.fields[q.key]}T12:00Z`).toISOString().slice(0,10)!==v.fields[q.key]))c.addIssue({code:"custom",message:"마감 날짜를 확인해주세요."});
  }
  if((v.weekly===null)!==(v.weeklySource==="none"))c.addIssue({code:"custom",message:"주간 목표의 입력 출처를 확인해주세요."});
});
export type ActivityProfile=z.infer<typeof activityProfileSchema>;
export const activityPreferencesSchema=z.object({version:z.literal(1),route:z.enum(["routine","schedule"]),profiles:z.array(activityProfileSchema).max(7)}).superRefine((v,c)=>{
  if(new Set(v.profiles.map(p=>p.domain)).size!==v.profiles.length)c.addIssue({code:"custom",message:"같은 분야가 중복됐어요."});
  if(v.profiles.filter(p=>p.enabled).length>2)c.addIssue({code:"custom",message:"한 번에는 최대 두 분야를 활성화해주세요."});
});
export type ActivityPreferences=z.infer<typeof activityPreferencesSchema>;
export function newActivityProfile(domain:ActivityDomain):ActivityProfile{return {domain,enabled:true,goal:"",current:"unknown",daily:10,weekly:30,dailySource:"proposal",weeklySource:"proposal",fields:{},activity:"",days:[],when:"between",updatedAt:new Date().toISOString()};}
export const orderedDays=[1,2,3,4,5,6,0];
export const dayNames=["일","월","화","수","목","금","토"];
export function activityAllocation(p:Pick<ActivityProfile,"days"|"daily"|"weekly">):Record<number,number>{
  const days=orderedDays.filter(d=>p.days.includes(d));if(!days.length)return {};
  return Object.fromEntries(days.map((d,i)=>[d,p.weekly===null?p.daily:Math.floor(p.weekly/days.length)+(i<p.weekly%days.length?1:0)]));
}
