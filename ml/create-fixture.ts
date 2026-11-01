// Synthetic pipeline fixture only. Never use its metrics as real recommendation evidence.
import { ML_FEATURES,ML_SCHEMA } from "../lib/routine-ml";
export function syntheticMLDataset(){
  let seed=42;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const rows=[];
  for(let day=0;day<40;day++)for(let group=0;group<3;group++)for(let candidate=0;candidate<5;candidate++){
    const date=new Date(Date.UTC(2026,6,day+1)).toISOString().slice(0,10),features=ML_FEATURES.map(()=>random());
    const label=+(features[0]+features[1]+.4*features[3]+.1*random()>1.1);
    rows.push({group:`fixture-${date}-${group}`,date,candidateId:`candidate-${candidate}`,exposedAt:`${date}T01:00:00.000Z`,labelAvailableAt:new Date(Date.parse(`${date}T00:00:00+09:00`)+36*3600000).toISOString(),features,label,ruleScore:features[0]*.45+features[1]*.4+features[2]*.15,displayPosition:candidate,selectionProbability:.2});
  }
  return {schema:ML_SCHEMA,task:"routine_completion",synthetic:true,featureNames:ML_FEATURES,rows};
}
