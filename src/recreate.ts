import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run recreate -- https://example.com");
  process.exit(1);
}

function run(cmd: string, args: string[]) {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npm", ["run", "capture", "--", url]);

const prompt = fs.readFileSync(path.resolve("prompts/recreate-site.md"), "utf8")
  .replaceAll("{{SOURCE_URL}}", url);

console.log("\nCapture complete.");
console.log("Next step: run this prompt in Cursor/Codex from the project root:\n");
console.log(prompt);
