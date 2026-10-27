import { createHmac, timingSafeEqual } from "node:crypto";

type SleepToken={userId:string;deliveryId:string;revision:number;sessionDate:string;kind:"bed"|"wake";expires:number};
export function signSleepToken(value:SleepToken,secret:string){const data=Buffer.from(JSON.stringify(value)).toString("base64url");return `${data}.${createHmac("sha256",secret).update(data).digest("base64url")}`;}
export function readSleepToken(token:string,secret:string,now=Date.now()):SleepToken|null{
  try{
    const [data,sig,extra]=token.split(".");if(extra||!data||!sig)return null;
    const expected=createHmac("sha256",secret).update(data).digest(),actual=Buffer.from(sig,"base64url");
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    const value=JSON.parse(Buffer.from(data,"base64url").toString()) as SleepToken;
    if(typeof value.userId!=="string"||typeof value.deliveryId!=="string"||!Number.isInteger(value.revision)||!/^\d{4}-\d{2}-\d{2}$/.test(value.sessionDate)||!["bed","wake"].includes(value.kind)||typeof value.expires!=="number"||value.expires<now)return null;
    return value;
  }catch{return null;}
}
