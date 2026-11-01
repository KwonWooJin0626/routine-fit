import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("outputs/ml-check",{recursive:true});
await build({entryPoints:["ml/create-fixture.ts","lib/routine-ml-inference.ts","lib/routine-ml.ts"],bundle:true,platform:"node",format:"esm",outdir:"outputs/ml-check/runtime"});
const {syntheticMLDataset}=await import("../outputs/ml-check/runtime/ml/create-fixture.js");
const {validateMLModel,predictRoutineML}=await import("../outputs/ml-check/runtime/lib/routine-ml-inference.js");
const {routineTrainingDataset}=await import("../outputs/ml-check/runtime/lib/routine-ml.js");
await writeFile("outputs/ml-check/synthetic.json",JSON.stringify(syntheticMLDataset()));
await writeFile("outputs/ml-check/empty-real.json",JSON.stringify(routineTrainingDataset(null)));
const python=process.env.ML_PYTHON??"python";
const boundaries=spawnSync(python,["ml/test_training.py"],{encoding:"utf8"});assert.equal(boundaries.status,0,boundaries.stderr);
for(const [input,out,extra] of [["empty-real.json","empty",[]],["synthetic.json","smoke",["--allow-synthetic"]]]){
  const result=spawnSync(python,["ml/train.py","--input",`outputs/ml-check/${input}`,"--out",`outputs/ml-check/${out}`,...extra],{encoding:"utf8"});
  if(result.status!==0){process.stderr.write(result.stderr||"Local training failed");process.exit(1);}
}
assert.equal(JSON.parse(await readFile("outputs/ml-check/empty/report.json","utf8")).status,"insufficient_data");
const model=JSON.parse(await readFile("outputs/ml-check/smoke/model.json","utf8"));
await writeFile("outputs/ml-check/synthetic-evaluation.json",await readFile("outputs/ml-check/smoke/report.json","utf8"));
assert.equal(validateMLModel(model),null,"Synthetic model must never be enabled in production");
const checked=validateMLModel(model,true);assert.ok(checked);
const parity=JSON.parse(await readFile("outputs/ml-check/smoke/parity.json","utf8"));
let maxDifference=0;const start=performance.now();
for(let i=0;i<parity.features.length;i++)maxDifference=Math.max(maxDifference,Math.abs(predictRoutineML(checked,parity.features[i])-parity.expected[i]));
assert.ok(maxDifference<1e-10,`Python/JS parity failed: ${maxDifference}`);
const report={synthetic:true,cases:parity.features.length,maxDifference,elapsedMs:performance.now()-start,productionModelRejected:true};
await writeFile("outputs/ml-check/parity-report.json",JSON.stringify(report,null,2));
// Reusing an output folder with insufficient real data must not leave a stale model.
const cleared=spawnSync(python,["ml/train.py","--input","outputs/ml-check/empty-real.json","--out","outputs/ml-check/smoke"],{encoding:"utf8"});assert.equal(cleared.status,0,cleared.stderr);
await assert.rejects(()=>readFile("outputs/ml-check/smoke/model.json"));
const outside=spawnSync(python,["ml/train.py","--input","outputs/ml-check/empty-real.json","--out","models"],{encoding:"utf8"});assert.notEqual(outside.status,0);
console.log("PASS: insufficient-data gate, synthetic-only LightGBM training, temporal evaluation, Python/JS inference parity and production rejection.");
console.log(JSON.stringify(report));
