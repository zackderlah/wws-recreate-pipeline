import fs from "node:fs";

const report = JSON.parse(fs.readFileSync("recreation/diff-report.json", "utf8"));
const compared = report.filter((r) => r.status === "compared");
const byPage = {};

for (const r of compared) {
  const slug = r.file.split("/")[0];
  (byPage[slug] ||= []).push(r.diffRatio);
}

const avg = Object.entries(byPage)
  .map(([slug, ratios]) => ({
    slug,
    avg: ratios.reduce((a, b) => a + b, 0) / ratios.length,
    max: Math.max(...ratios)
  }))
  .sort((a, b) => b.avg - a.avg);

console.log("Worst 20 pages by avg diff:");
for (const p of avg.slice(0, 20)) {
  console.log(`${p.slug}: avg ${(p.avg * 100).toFixed(1)}%, max ${(p.max * 100).toFixed(1)}%`);
}
console.log(
  `Overall avg: ${((compared.reduce((s, r) => s + r.diffRatio, 0) / compared.length) * 100).toFixed(1)}%`
);
