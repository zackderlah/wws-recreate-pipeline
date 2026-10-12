import { chromium, Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { VIEWPORTS, MAX_PAGES, NAV_TIMEOUT, SETTLE_MS } from "./config.js";
import { cleanUrl, ensureDir, sameOrigin, slugifyUrl, writeJson } from "./utils.js";

const startUrl = process.argv[2];
if (!startUrl) {
  console.error("Usage: npm run capture -- https://example.com");
  process.exit(1);
}

const outRoot = path.resolve("recreation/source");
ensureDir(outRoot);

// Browser-side scripts as strings to avoid tsx/esbuild __name injection in page.evaluate.
const SETTLE_SCRIPT = `async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = Math.max(500, Math.floor(window.innerHeight * 0.75));
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await delay(80);
  }
  window.scrollTo(0, 0);
}`;

const EXTRACT_SCRIPT = `() => {
  const abs = (v) => {
    if (!v) return null;
    try { return new URL(v, location.href).href; } catch { return v; }
  };
  const nodes = [...document.querySelectorAll("header,nav,main,section,article,footer")];
  const sections = nodes.map((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      index: i,
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: el.className || null,
      x: Math.round(r.x + scrollX),
      y: Math.round(r.y + scrollY),
      width: Math.round(r.width),
      height: Math.round(r.height),
      backgroundColor: cs.backgroundColor,
      backgroundImage: cs.backgroundImage,
      color: cs.color,
      text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 3000)
    };
  });

  const images = [...document.images].map((img) => ({
    src: abs(img.currentSrc || img.src),
    alt: img.alt || "",
    width: img.naturalWidth,
    height: img.naturalHeight
  }));

  const links = [...document.querySelectorAll("a[href]")].map((a) => ({
    href: abs(a.getAttribute("href")),
    text: (a.textContent || "").trim()
  }));

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
    tag: h.tagName.toLowerCase(),
    text: (h.textContent || "").trim()
  }));

  const forms = [...document.forms].map((f) => ({
    action: abs(f.getAttribute("action")),
    method: (f.getAttribute("method") || "get").toLowerCase(),
    fields: [...f.querySelectorAll("input,textarea,select,button")].map((x) => ({
      tag: x.tagName.toLowerCase(),
      type: x.type || null,
      name: x.name || null,
      placeholder: x.placeholder || null
    }))
  }));

  const styles = getComputedStyle(document.body);
  const cssVars = {};
  for (const k of Array.from(styles)) {
    if (k.startsWith("--")) cssVars[k] = styles.getPropertyValue(k).trim();
  }

  const metadata = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null
  };

  return { url: location.href, metadata, headings, links, images, forms, sections, cssVars };
}`;

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(`(${SETTLE_SCRIPT})()`);
  await page.waitForTimeout(SETTLE_MS);
}

async function extract(page: Page) {
  return await page.evaluate<{
    metadata: { title: string; description: string | null };
    images: Array<{ src: string | null }>;
    links: Array<{ href: string | null }>;
  }>(`(${EXTRACT_SCRIPT})()`);
}

async function downloadAsset(url: string, destDir: string) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/") && !ct.includes("font") && !ct.includes("css")) return null;
    const u = new URL(url);
    let name = path.basename(u.pathname) || "asset";
    name = name.replace(/[^\w.\-]+/g, "_");
    const file = path.join(destDir, name);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    return file;
  } catch {
    return null;
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultNavigationTimeout(NAV_TIMEOUT);

const queue = [new URL(startUrl).toString()];
const seen = new Set<string>();
const siteManifest: any[] = [];
const allAssets = new Set<string>();
const measurements: Record<string, Record<string, unknown>> = {};

while (queue.length && seen.size < MAX_PAGES) {
  const url = queue.shift()!;
  if (seen.has(url)) continue;
  seen.add(url);
  console.log(`Capturing ${url}`);

  try {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);

    const data = await extract(page);
    const slug = slugifyUrl(url);
    const pageDir = path.join(outRoot, "pages", slug);
    ensureDir(pageDir);

    fs.writeFileSync(path.join(pageDir, "dom.html"), await page.content());
    writeJson(path.join(pageDir, "structure.json"), data);
    measurements[slug] = {};

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await settle(page);
      // Keep the rendered asset variants and SVG backgrounds alongside each screenshot.
      // Site adapters use these as evidence, never as editable layout fields.
      measurements[slug][name] = await page.evaluate(`(() => ({
        height: document.documentElement.scrollHeight,
        rows: [...document.querySelectorAll('img[id^="element_"]')].map(img => ({
          id: img.id,
          src: img.currentSrc || img.src,
          css: { backgroundImage: getComputedStyle(img).backgroundImage }
        }))
      }))()`);
      await page.screenshot({
        path: path.join(pageDir, `${name}.png`),
        fullPage: true
      });
    }
    writeJson(path.join(outRoot, "measurements.json"), measurements);

    siteManifest.push({
      url,
      slug,
      title: data.metadata.title,
      description: data.metadata.description
    });

    for (const img of data.images) if (img.src) allAssets.add(img.src);
    for (const link of data.links) {
      if (!link.href) continue;
      const cleaned = cleanUrl(link.href, url);
      if (!cleaned) continue;
      if (sameOrigin(cleaned, startUrl) && !seen.has(cleaned)) queue.push(cleaned);
    }
  } catch (err) {
    console.error(`Failed ${url}`, err);
  }
}

const assetsDir = path.join(outRoot, "assets");
ensureDir(assetsDir);
for (const asset of allAssets) await downloadAsset(asset, assetsDir);

writeJson(path.join(outRoot, "sitemap.json"), siteManifest);
writeJson(path.join(outRoot, "site-data.json"), {
  sourceUrl: startUrl,
  capturedAt: new Date().toISOString(),
  pages: siteManifest.length,
  assets: [...allAssets]
});

await browser.close();
console.log(`Done. Captured ${siteManifest.length} pages.`);
