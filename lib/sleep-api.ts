import { sleepSettingsSchema,sleepCheckinSchema,sleepCorrectionSchema,plannedSleepTime,sleepSessionDate,validateActualAt,type SleepSettings,type SleepRecord } from "./sleep";
import { PetError } from "./pet-model";

export type SleepProfile={settings:SleepSettings;revision:number;email:string};
export type SleepIdentity={userId:string;email:string;verified:boolean};
export interface SleepRepository{
  get:(id:string)=>Promise<{profile:SleepProfile|null;records:SleepRecord[]}>;
  settings:(id:string,email:string,settings:SleepSettings,revision:number)=>Promise<SleepProfile|null>;
  checkin:(id:string,record:SleepRecord)=>Promise<SleepRecord>;
  correct:(id:string,recordId:string,actualAt:string|null,now:string)=>Promise<SleepRecord|null>;
  emailCheckin:(id:string,token:string,now:Date)=>Promise<SleepRecord|null>;
}
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
export function createSleepHandlers(identity:()=>Promise<SleepIdentity|null>,repo:SleepRepository,capability:()=>{mailConfigured:boolean;schedulerConfigured:boolean},clock=()=>new Date()){
  const sameOrigin=(r:Request)=>r.headers.get("origin")===new URL(r.url).origin;
  return {
    async GET(){const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);try{return response({...await repo.get(user.userId),...capability()});}catch{return response({error:"수면 기록을 불러오지 못했어요."},503);}},
    async PUT(request:Request){
      const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);if(!sameOrigin(request))return response({error:"같은 사이트에서 요청해주세요."},403);
      try{
        const raw=await request.text();if(raw.length>4000)return response({error:"입력이 너무 길어요."},413);
        const input=JSON.parse(raw),settings=sleepSettingsSchema.safeParse(input.settings);
        if(!settings.success||!Number.isInteger(input.revision)||input.revision<0)return response({error:"시간과 요일을 확인해주세요."},400);
        if(settings.data.emailEnabled&&(!user.verified||!capability().mailConfigured||!capability().schedulerConfigured))return response({error:"Resend·예약 발송 설정과 인증된 이메일을 확인한 후 메일 알림을 사용할 수 있어요. 지금은 웹 체크인을 이용해주세요."},400);
        const profile=await repo.settings(user.userId,user.verified?user.email:"",settings.data,input.revision);
        return profile?response({profile}):response({error:"다른 창에서 설정이 바뀌었어요. 다시 불러와주세요."},409);
      }catch{return response({error:"설정을 저장하지 못했어요. 입력을 확인하거나 잠시 후 다시 시도해주세요."},503);}
    },
    async POST(request:Request){
      const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);if(!sameOrigin(request))return response({error:"같은 사이트에서 요청해주세요."},403);
      let input:ReturnType<typeof sleepCheckinSchema.parse>;
      try{const raw=await request.text();if(raw.length>4000)return response({error:"입력이 너무 길어요."},413);input=sleepCheckinSchema.parse(JSON.parse(raw));}catch{return response({error:"체크인 내용을 확인해주세요."},400);}
      try{
        const now=clock();if(input.token){const record=await repo.emailCheckin(user.userId,input.token,now);return record?response({record}):response({error:"만료·사용되었거나 현재 계정과 다른 확인 링크예요. 웹 체크인을 이용해주세요."},400);}
        const {profile}=await repo.get(user.userId);if(!profile)return response({error:"취침·기상 목표를 먼저 저장해주세요."},400);
        if(input.actualAt&&!validateActualAt(input.actualAt,now.toISOString(),now))return response({error:"실제 시각은 미래이거나 확인 시각과 너무 멀 수 없어요."},400);
        const date=sleepSessionDate(input.kind,now,profile.settings),record:SleepRecord={id:`${date}-${input.kind}`,sessionDate:date,kind:input.kind,plannedAt:plannedSleepTime(date,input.kind,profile.settings),checkedAt:now.toISOString(),actualAt:input.actualAt??null,method:input.kind==="bed"&&profile.settings.bedReference==="alarm-setting"?"alarm-setting":"web",updatedAt:now.toISOString()};
        return response({record:await repo.checkin(user.userId,record)});
      }catch{return response({error:"체크인을 저장하지 못했어요. 다시 시도해주세요."},503);}
    },
    async PATCH(request:Request){
      const user=await identity();if(!user)return response({error:"로그인이 필요해요."},401);if(!sameOrigin(request))return response({error:"같은 사이트에서 요청해주세요."},403);
      try{
        const raw=await request.text();if(raw.length>2000)return response({error:"입력이 너무 길어요."},413);const input=sleepCorrectionSchema.safeParse(JSON.parse(raw));if(!input.success)return response({error:"수정 내용을 확인해주세요."},400);
        const now=clock(),{records}=await repo.get(user.userId),old=records.find(r=>r.id===input.data.id);
        if(!old)return response({error:"기록을 찾을 수 없어요."},404);
        if(!validateActualAt(input.data.actualAt,old.checkedAt,now))return response({error:"실제 시각은 미래이거나 확인 시각과 36시간 넘게 차이 날 수 없어요."},400);
        const record=await repo.correct(user.userId,old.id,input.data.actualAt,now.toISOString());return record?response({record}):response({error:"기록을 찾을 수 없어요."},404);
      }catch(e){return e instanceof PetError?response({error:e.message},e.status):response({error:"수정 내용을 저장하지 못했어요."},503);}
    },
  };
}
