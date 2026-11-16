import "server-only";

export function mealMailConfig(){
  const {RESEND_API_KEY:key,SLEEP_EMAIL_FROM:from,SLEEP_APP_URL:rawUrl,CRON_SECRET:secret}=process.env;
  if(!key||!from||!rawUrl||!secret)return null;
  try{
    const url=new URL(rawUrl);
    return url.protocol==="https:"?{key,from,url,secret}:null;
  }catch{return null;}
}
