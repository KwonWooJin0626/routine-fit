import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";

const files = ["engine", "planner", "state-api", "onboarding", "chapter-scroll", "nutrition", "nutrition-ui", "planner-progress", "planner-placement", "growth", "activities", "sleep", "pet"];
await fs.mkdir("outputs/tests", { recursive: true });
await build({ entryPoints: files.map(name => `tests/${name}.test.${["onboarding","nutrition-ui","growth","activities","pet"].includes(name) ? "tsx" : "ts"}`), bundle: true, jsx: "automatic", external: ["react", "react-dom", "react-dom/server", "lucide-react"], platform: "node", format: "esm", outdir: "outputs/tests", outExtension: { ".js": ".mjs" } });
const result = spawnSync(process.execPath, ["--test", ...files.map(name => `outputs/tests/${name}.test.mjs`)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
