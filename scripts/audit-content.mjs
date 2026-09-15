import fs from "node:fs";
import path from "node:path";

const pages = JSON.parse(fs.readFileSync("website/src/cms/pages.json", "utf8"));
const sourceRoot = "recreation/source/pages";

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countSourceParagraphs(slug) {
  const domPath = path.join(sourceRoot, slug, "dom.html");
  if (!fs.existsSync(domPath)) return 0;
  const dom = fs.readFileSync(domPath, "utf8");
  const footer = dom.search(/footerGroup|Designed by/i);
  const region = dom.slice(0, footer >= 0 ? footer : dom.length);
  const ps = region.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const divs = region.match(/<div>\s*[^<\s&][\s\S]*?<\/div>/gi) || [];
  return ps.filter((p) => stripTags(p).length > 20).length + divs.filter((d) => stripTags(d).length > 20).length;
}

function countCmsContent(page) {
  if (page.blocks?.length) return page.blocks.length;
  if (page.body?.length) return page.body.length;
  if (page.description?.length) return page.description.length;
  if (page.sections?.length) return page.sections.length;
  return 0;
}

const rows = [];
for (const [pagePath, page] of Object.entries(pages)) {
  const sourceCount = countSourceParagraphs(page.slug);
  const cmsCount = countCmsContent(page);
  if (sourceCount > cmsCount + 2) {
    rows.push({ path: pagePath, type: page.type, sourceCount, cmsCount, gap: sourceCount - cmsCount });
  }
}

rows.sort((a, b) => b.gap - a.gap);
console.log("Pages with likely missing content (source blocks >> CMS blocks):");
for (const r of rows.slice(0, 25)) {
  console.log(`${r.path} [${r.type}]: source~${r.sourceCount} cms=${r.cmsCount} gap=${r.gap}`);
}
