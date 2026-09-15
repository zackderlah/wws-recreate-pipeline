import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { VIEWPORTS } from "./config.js";
import { ensureDir } from "./utils.js";

const sitemap = JSON.parse(
  fs.readFileSync(path.resolve("recreation/source/sitemap.json"), "utf8")
) as Array<{ slug: string; url: string }>;

const previewUrl = process.env.PREVIEW_URL || "http://localhost:4321";
const outRoot = path.resolve("recreation/generated/pages");
ensureDir(outRoot);

const seen = new Set<string>();
const pages = sitemap.filter((entry) => {
  if (seen.has(entry.slug)) return false;
  seen.add(entry.slug);
  return true;
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();

for (const entry of pages) {
  const url = new URL(entry.url).pathname;
  const target = `${previewUrl}${url}`;
  const pageDir = path.join(outRoot, entry.slug);
  ensureDir(pageDir);

  console.log(`Screenshot ${target}`);

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await page.goto(target, { waitUntil: "networkidle", timeout: 60000 }).catch(() =>
      page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 })
    );
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(pageDir, `${name}.png`),
      fullPage: true
    });
  }
}

await browser.close();
console.log(`Saved screenshots for ${pages.length} pages.`);
