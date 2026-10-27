import { currentUser } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { createSleepHandlers } from "@/lib/sleep-api";
import { sleepRepository } from "@/lib/sleep-repository";

export const dynamic="force-dynamic";
const handlers=createSleepHandlers(async()=>{
  const session=await getSessionUser();if(!session)return null;
  const user=await currentUser(),email=user?.primaryEmailAddress;
  return {userId:session.userId,email:email?.emailAddress??"",verified:email?.verification?.status==="verified"};
},sleepRepository,()=>({mailConfigured:!!(process.env.RESEND_API_KEY&&process.env.SLEEP_EMAIL_FROM&&process.env.SLEEP_TOKEN_SECRET&&process.env.SLEEP_APP_URL),schedulerConfigured:process.env.SLEEP_EMAIL_SCHEDULER_ENABLED==="true"&&!!process.env.CRON_SECRET}));
export const GET=handlers.GET;
export const PUT=handlers.PUT;
export const POST=handlers.POST;
export const PATCH=handlers.PATCH;
