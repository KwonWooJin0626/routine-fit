import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({entryPoints:["tests/pet-db.integration.ts"],bundle:true,platform:"node",format:"esm",packages:"external",outfile:"outputs/pet-db.integration.mjs",plugins:[{name:"server-only-integration",setup(b){b.onResolve({filter:/^server-only$/},()=>({path:"server-only",namespace:"empty-marker"}));b.onLoad({filter:/.*/,namespace:"empty-marker"},()=>({contents:"",loader:"js"}));}}]});
const result=spawnSync(process.execPath,["--env-file=.env.local","outputs/pet-db.integration.mjs"],{stdio:"inherit"});process.exitCode=result.status??1;
