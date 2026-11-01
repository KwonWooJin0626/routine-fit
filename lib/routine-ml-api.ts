import { routineTrainingDataset } from "./routine-ml";
import type { RecommendationDocument } from "./recommendation-model";

export function createMLTrainingHandler(identity:()=>Promise<string|null>,read:(id:string)=>Promise<RecommendationDocument|null>,clock=()=>new Date(),modelId:string|null=null){
  return async(request:Request)=>{
    const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
    const id=await identity();if(!id)return Response.json({error:"로그인이 필요해요."},{status:401,headers});
    const params=new URL(request.url).searchParams;
    if([...params.keys()].some(k=>k!=="download")||params.has("download")&&params.get("download")!=="1")return Response.json({error:"내 계정의 추천 기록만 확인할 수 있어요."},{status:400,headers});
    try{
      const data=routineTrainingDataset(await read(id),clock());
      if(params.get("download")==="1")return Response.json(data,{headers:{...headers,"Content-Disposition":"attachment; filename=\"routine-fit-training.json\""}});
      return Response.json({schema:data.schema,summary:data.summary,mode:modelId?"shadow":"collecting",modelId,serving:"rules",note:"모델 비교는 기존 추천을 바꾸지 않아요. 미확인·부분 실행·시간 부족 기록은 완료/거절 학습에서 구분해요."},{headers});
    }catch{return Response.json({error:"추천 학습 현황을 불러오지 못했어요."},{status:503,headers});}
  };
}
