import { createHash,timingSafeEqual } from "node:crypto";
import { and,eq,or,lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sleepProfiles,sleepDeliveries,sleepRecords } from "@/db/schema";
import { dueSleepEvents,sleepSettingsSchema } from "@/lib/sleep";
import { signSleepToken } from "@/lib/sleep-token";

export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,auth=request.headers.get("authorization")??"";
  if(!secret||Buffer.byteLength(auth)!==Buffer.byteLength(`Bearer ${secret}`)||!timingSafeEqual(Buffer.from(auth),Buffer.from(`Bearer ${secret}`)))return Response.json({error:"Unauthorized"},{status:401});
  if(process.env.SLEEP_EMAIL_SCHEDULER_ENABLED!=="true"||!process.env.RESEND_API_KEY||!process.env.SLEEP_EMAIL_FROM||!process.env.SLEEP_TOKEN_SECRET||!process.env.SLEEP_APP_URL)return Response.json({status:"configuration_pending",sent:0});
  const appUrl=new URL(process.env.SLEEP_APP_URL);if(appUrl.protocol!=="https:")return Response.json({error:"HTTPS application URL required"},{status:503});
  const now=new Date(),db=getDb();let sent=0,failed=0;
  try{
    // A bounded page keeps a single invocation within function limits. A cursor can be supplied by the scheduler.
    const cursor=new URL(request.url).searchParams.get("cursor")??"";
    const {gt}=await import("drizzle-orm");
    const profiles=await db.select().from(sleepProfiles).where(gt(sleepProfiles.userId,cursor)).orderBy(sleepProfiles.userId).limit(100);
    for(const p of profiles){
      const parsed=sleepSettingsSchema.safeParse(JSON.parse(p.settings));if(!parsed.success||!p.email)continue;
      for(const event of dueSleepEvents(parsed.data,now)){
        const id=createHash("sha256").update(`${p.userId}:${p.revision}:${event.sessionDate}:${event.kind}`).digest("hex");
        const existing=await db.select({id:sleepRecords.id}).from(sleepRecords).where(and(eq(sleepRecords.userId,p.userId),eq(sleepRecords.sessionDate,event.sessionDate),eq(sleepRecords.kind,event.kind))).limit(1);if(existing.length)continue;
        const values={id,userId:p.userId,revision:p.revision,...event,status:"sending",attemptedAt:now.toISOString()};
        let claimed=(await db.insert(sleepDeliveries).values(values).onConflictDoNothing().returning()).length>0;
        if(!claimed){const rows=await db.update(sleepDeliveries).set({status:"sending",attemptedAt:now.toISOString()}).where(and(eq(sleepDeliveries.id,id),or(eq(sleepDeliveries.status,"failed"),and(eq(sleepDeliveries.status,"sending"),lt(sleepDeliveries.attemptedAt,new Date(now.getTime()-120000).toISOString()))))).returning();claimed=rows.length>0;}
        if(!claimed)continue;
        const latest=await db.select().from(sleepProfiles).where(eq(sleepProfiles.userId,p.userId)).limit(1);if(latest[0]?.revision!==p.revision)continue;
        const token=signSleepToken({userId:p.userId,deliveryId:id,revision:p.revision,sessionDate:event.sessionDate,kind:event.kind,expires:new Date(event.plannedAt).getTime()+12*3600000},process.env.SLEEP_TOKEN_SECRET);
        const url=new URL("/sleep/confirm",appUrl);url.searchParams.set("token",token);
        const label=event.kind==="wake"?"기상":"취침 준비";
        try{
          const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`sleep-${id}`},body:JSON.stringify({from:process.env.SLEEP_EMAIL_FROM,to:[p.email],subject:`ROUTINE FIT · ${label} 체크인`,text:`설정한 ${label} 목표 시각이에요.\n아래 확인 화면에서 직접 버튼을 눌러 기록해주세요. 링크를 여는 것만으로 완료되지 않아요.\n${url.toString()}\n\n메일은 전달이 늦을 수 있어요. 기상 알람은 휴대전화에서 사용해주세요.\n알림 중지·요일 변경: ${new URL("/?view=sleep",appUrl).toString()}`}),signal:AbortSignal.timeout(15000)});
          if(!res.ok)throw new Error("provider_failed");
          const result=await res.json() as {id?:string};await db.update(sleepDeliveries).set({status:"sent",providerId:result.id??null}).where(eq(sleepDeliveries.id,id));sent++;
        }catch{await db.update(sleepDeliveries).set({status:"failed"}).where(eq(sleepDeliveries.id,id));failed++;console.error("sleep_email_send_failed");}
      }
    }
    return Response.json({sent,failed,nextCursor:profiles.length===100?profiles.at(-1)!.userId:null});
  }catch{console.error("sleep_dispatch_failed");return Response.json({error:"예약 발송 처리에 실패했어요."},{status:503});}
}
