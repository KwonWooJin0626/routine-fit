import { ML_FEATURES,ML_SCHEMA } from "./routine-ml";

export type MLTree={leaf:number}|{feature:number;threshold:number;missingLeft:boolean;zeroMissing:boolean;left:MLTree;right:MLTree};
export type RoutineMLModel={schema:typeof ML_SCHEMA;modelId:string;featureNames:string[];evaluationOnly:boolean;trees:MLTree[]};
export function validateMLModel(raw:unknown,allowEvaluation=false):RoutineMLModel|null{
  const v=raw as RoutineMLModel;if(!v||v.schema!==ML_SCHEMA||typeof v.modelId!=="string"||v.modelId.length>100||typeof v.evaluationOnly!=="boolean"||v.evaluationOnly&&!allowEvaluation||JSON.stringify(v.featureNames)!==JSON.stringify(ML_FEATURES)||!Array.isArray(v.trees)||!v.trees.length||v.trees.length>300)return null;
  let nodes=0;const tree=(t:MLTree,depth=0):boolean=>{if(++nodes>20000||depth>16||!t||typeof t!=="object")return false;if("leaf" in t)return Number.isFinite(t.leaf);return Number.isInteger(t.feature)&&t.feature>=0&&t.feature<ML_FEATURES.length&&Number.isFinite(t.threshold)&&typeof t.missingLeft==="boolean"&&typeof t.zeroMissing==="boolean"&&tree(t.left,depth+1)&&tree(t.right,depth+1);};
  return v.trees.every(t=>tree(t))?v:null;
}
export function predictRoutineML(model:RoutineMLModel,features:number[]){
  if(features.length!==ML_FEATURES.length||features.some(v=>!Number.isFinite(v)))throw Error("ML feature mismatch");
  let score=0;for(let t of model.trees){while(!("leaf" in t)){const x=features[t.feature];t=(t.zeroMissing&&x===0?t.missingLeft:x<=t.threshold)?t.left:t.right;}score+=t.leaf;}
  if(!Number.isFinite(score))throw Error("Invalid ML score");return score>=0?1/(1+Math.exp(-score)):Math.exp(score)/(1+Math.exp(score));
}
