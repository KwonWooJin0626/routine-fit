import { createHash,timingSafeEqual } from "node:crypto";
import { and,eq,gt,sql } from "drizzle-orm";
import { getDb } from "@/db";
import { petCompanions,sleepDeliveries,sleepProfiles,userStates } from "@/db/schema";
import { mealMailConfig } from "@/lib/meal-mail-config";
import { hasMealRecord,mealReminderWindow } from "@/lib/meal-reminders";

export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request,{params}:{params:Promise<{slot:string}>}){
  const auth=Buffer.from(request.headers.get("authorization")??"");
  const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET??""}`);
  if(!process.env.CRON_SECRET||auth.length!==expected.length||!timingSafeEqual(auth,expected))return Response.json({error:"Unauthorized"},{status:401});
  const mail=mealMailConfig();
  if(!mail)return Response.json({status:"configuration_pending",sent:0});
  const {slot}=await params;
  if(slot!=="lunch"&&slot!=="dinner")return Response.json({error:"Unknown meal window"},{status:404});
  const now=new Date(),window=mealReminderWindow(slot,now);
  if(!window)return Response.json({status:"outside_window",sent:0});
  const kind=`meal-${slot}`,db=getDb();
  let sent=0,failed=0,cursor="";
  try{
    while(Date.now()-now.getTime()<40000){
      const rows=await db.select({userId:sleepProfiles.userId,email:sleepProfiles.email,revision:sleepProfiles.revision,
        journal:sql<string>`${userStates.payload}::jsonb #>> '{activityJournal,records}'`,
        legacy:sql<string>`${petCompanions.payload}::jsonb ->> 'records'`,
      }).from(sleepProfiles).innerJoin(userStates,eq(sleepProfiles.userId,userStates.userId))
        .leftJoin(petCompanions,eq(sleepProfiles.userId,petCompanions.userId))
        .where(and(gt(sleepProfiles.userId,cursor),sql`${sleepProfiles.settings}::jsonb -> 'mealEmailEnabled' = 'true'::jsonb`))
        .orderBy(sleepProfiles.userId).limit(20);
      for(const p of rows){
        if(Date.now()-now.getTime()>=40000)return Response.json({sent,failed,partial:true});
        cursor=p.userId;
        if(!p.email||hasMealRecord(JSON.parse(p.journal??p.legacy??"[]"),window))continue;
        const id=createHash("sha256").update(`${p.userId}:${window.date}:${kind}`).digest("hex");
        const [claimed]=await db.insert(sleepDeliveries).values({id,userId:p.userId,revision:p.revision,sessionDate:window.date,
          kind,plannedAt:new Date(window.until).toISOString(),attemptedAt:now.toISOString(),status:"sending",
        }).onConflictDoNothing().returning({id:sleepDeliveries.id});
        if(!claimed)continue;
        const [latest]=await db.select({revision:sleepProfiles.revision,journal:sql<string>`${userStates.payload}::jsonb #>> '{activityJournal,records}'`})
          .from(sleepProfiles).innerJoin(userStates,eq(sleepProfiles.userId,userStates.userId)).where(eq(sleepProfiles.userId,p.userId));
        if(!latest||latest.revision!==p.revision||hasMealRecord(JSON.parse(latest.journal??p.legacy??"[]"),window)){
          await db.delete(sleepDeliveries).where(eq(sleepDeliveries.id,id));continue;
        }
        try{
          const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${mail.key}`,"Content-Type":"application/json","Idempotency-Key":id},
            body:JSON.stringify({from:mail.from,to:[p.email],subject:"식사 기록할 시간이에요",text:`식사하셨다면 ROUTINE FIT에 식사 시간을 기록해 주세요.\n실천 체크 열기: ${new URL("/",mail.url)}\n\n내 정보 → 식사 기록 알림에서 메일을 끌 수 있어요.`}),signal:AbortSignal.timeout(7000)});
          if(!response.ok)throw Error("email_provider_error");
          const {id:providerId}=await response.json();
          await db.update(sleepDeliveries).set({status:"sent",providerId}).where(eq(sleepDeliveries.id,id));
          sent++;
        }catch{
          await db.update(sleepDeliveries).set({status:"failed"}).where(eq(sleepDeliveries.id,id));
          failed++;
        }
      }
      if(rows.length<20)break;
    }
    return Response.json({sent,failed});
  }catch{
    console.error("meal_reminder_dispatch_failed");
    return Response.json({error:"식사 알림을 처리하지 못했어요."},{status:503});
  }
}
