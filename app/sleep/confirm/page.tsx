import { getCurrentUser } from "@/lib/auth";
import { SleepConfirmation } from "@/components/sleep-confirmation";
export const dynamic="force-dynamic";
export const metadata={title:"수면 체크인 | ROUTINE FIT",referrer:"no-referrer",robots:{index:false,follow:false}};
export default async function SleepConfirmPage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const {token}=await searchParams,user=await getCurrentUser();
  if(!user)return <main className="import-page"><h1>내 계정으로 로그인해주세요</h1><p>메일을 여는 것만으로 체크인이 기록되지 않아요. 로그인한 뒤 확인 버튼을 눌러주세요.</p><a className="button primary" href={`/sign-in?redirect_url=${encodeURIComponent(`/sleep/confirm?token=${token??""}`)}`}>로그인하고 확인</a></main>;
  return <main className="import-page"><SleepConfirmation token={typeof token==="string"?token:""}/></main>;
}
