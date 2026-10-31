import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({entryPoints:["tests/activities-db.integration.ts"],bundle:true,platform:"node",format:"esm",packages:"external",outfile:"outputs/activities-db.integration.mjs",plugins:[{name:"server-only-integration",setup(build){build.onResolve({filter:/^server-only$/},()=>({path:"server-only",namespace:"empty-marker"}));build.onLoad({filter:/.*/,namespace:"empty-marker"},()=>({contents:"",loader:"js"}));}}]});
const result=spawnSync(process.execPath,["--env-file=.env.local","outputs/activities-db.integration.mjs"],{stdio:"inherit"});
process.exitCode=result.status??1;
