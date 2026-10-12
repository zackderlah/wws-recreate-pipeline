import fs from "node:fs";
import path from "node:path";

const configArg = process.argv.slice(2).find((arg) => arg.startsWith("--config="));
const configPath = path.resolve(configArg?.slice("--config=".length) || "sites/alisongreenwayart.json");
const sourceRoot = path.resolve("recreation/source");
const sitemapPath = path.join(sourceRoot, "sitemap.json");

if (!fs.existsSync(sitemapPath)) {
  console.error("Capture the source first: npm run recreate -- https://example.com");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const sitemap = JSON.parse(fs.readFileSync(sitemapPath, "utf8"));
if (!config.id || !config.sourceUrl || !Array.isArray(sitemap) || !sitemap.length) {
  throw new Error("A site id, sourceUrl and non-empty captured sitemap are required.");
}
const sourceOrigin = new URL(config.sourceUrl).origin;
for (const page of sitemap) {
  if (new URL(page.url).origin !== sourceOrigin || !page.slug || /[/\\]/.test(page.slug) || page.slug === "..") {
    throw new Error(`Capture does not match the selected site or has an invalid slug: ${page.url}`);
  }
}

const reportPath = path.resolve("recreation/diff-report.json");
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : [];
const results = new Map(report.map((row) => [row.file, row]));
const lines = [
  `# WWS fidelity review: ${config.id}`,
  "",
  `Source: ${config.sourceUrl}`,
  `Prepared: ${new Date().toISOString()}`,
  "",
  "Compare the source with the latest published WWS draft. Preserve the source design; do not redesign.",
  "Verify every listed route at desktop 1440×900, tablet 1024×768 and mobile 390×844.",
  "Check typography/fonts, spacing, colors, section heights/order, images/crops, navigation, responsive behavior and interactions.",
  "Check full-page dimensions and missing sections separately: WWS pixel ratios currently compare only the common image area.",
  "Build Astro/TypeScript/Tailwind components; keep layout in code and editable content in WWS CMS fields.",
  "Use local original assets; flag missing forms, embeds, integrations and motion instead of silently dropping them.",
  "",
  "## Local evidence (verify freshness before filing)",
  "",
  "These paths are local and are not automatically visible to a remote reviewer. Supply a published draft and relevant review context.",
  ""
];

for (const page of sitemap) {
  lines.push(`### ${page.slug}`, "", `Source: ${page.url}`, `Draft route: ${new URL(page.url).pathname}`, "");
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    const rel = `${page.slug}/${viewport}.png`;
    const source = fs.existsSync(path.join(sourceRoot, "pages", rel));
    const generated = fs.existsSync(path.resolve("recreation/generated/pages", rel));
    const diff = fs.existsSync(path.resolve("recreation/diff", rel));
    const result = results.get(rel);
    const ratio = source && generated && diff && result?.status === "compared" && Number.isFinite(result.diffRatio)
      ? `${(result.diffRatio * 100).toFixed(2)}% pixel difference (diagnostic only)`
      : "comparison pending";
    lines.push(`- ${viewport}: source ${source ? "present" : "MISSING"}; generated ${generated ? "present" : "MISSING"}; diff ${diff ? "present" : "MISSING"}; ${ratio}.`);
  }
  lines.push("");
}

lines.push("## Findings to return", "", "For each issue give the route, viewport, element/section, expected appearance or behavior, actual difference and severity. Record unresolved issues and review status in RECREATION_REPORT.md. Limit the QA/fix cycle to three passes.", "");
const out = path.resolve("recreation/review/brief.md");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"));
console.log(`Prepared ${out} for ${sitemap.length} pages. No upload or review was submitted.`);
