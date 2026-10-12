import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { spawnSync } from "node:child_process";

type SiteConfig = {
  id: string;
  sourceUrl: string;
  collectionSlugs: string[];
  blogPostSlugs: string[];
  staticTypes: Record<string, string>;
  adapter?: string;
};

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.findLast((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function resolveWebsiteDir() {
  const fromArg = readArg("website-dir");
  if (fromArg) return path.resolve(fromArg);
  const sibling = path.resolve("../alisongreenwayart-recreation-wws");
  if (fs.existsSync(path.join(sibling, "package.json"))) return sibling;
  return path.resolve("website");
}

function loadSiteConfig() {
  const configPath = path.resolve(readArg("config") || "sites/alisongreenwayart.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as SiteConfig;
}

const siteConfig = loadSiteConfig();
const websiteDir = resolveWebsiteDir();
if (siteConfig.adapter) {
  if (siteConfig.adapter !== "beyondbooks") throw new Error(`Unknown site adapter: ${siteConfig.adapter}`);
  const result = spawnSync(process.execPath, [path.resolve("scripts/prepare-beyondbooks.mjs"), `--website-dir=${websiteDir}`], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
const sourceRoot = path.resolve("recreation/source");
const cmsRoot = path.resolve(websiteDir, "src/cms");
const assetsRoot = path.resolve(websiteDir, "public/assets");
const sitemap = JSON.parse(fs.readFileSync(path.join(sourceRoot, "sitemap.json"), "utf8")) as Array<{
  url: string;
  slug: string;
  title: string;
  description: string | null;
}>;

const COLLECTION_SLUGS = new Set(siteConfig.collectionSlugs);
const BLOG_POST_SLUGS = new Set(siteConfig.blogPostSlugs);
const STATIC_TYPES = siteConfig.staticTypes;

const assetMap = new Map<string, string>();

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function urlToPath(url: string) {
  const u = new URL(url);
  return u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "");
}

function localAssetName(url: string) {
  const u = new URL(url);
  return path.basename(u.pathname).replace(/[^\w.\-]+/g, "_");
}

async function downloadAsset(url: string) {
  if (!url || !url.startsWith("http")) return null;
  if (assetMap.has(url)) return assetMap.get(url)!;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const name = localAssetName(url);
    const file = path.join(assetsRoot, name);
    if (!fs.existsSync(file)) {
      ensureDir(assetsRoot);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    const local = `/assets/${name}`;
    assetMap.set(url, local);
    return local;
  } catch {
    return null;
  }
}

function decodeHtml(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#xa0;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string) {
  return decodeHtml(html.replace(/<[^>]+>/g, ""));
}

function isFooterContent(text: string) {
  if (!text || text.length < 3) return true;
  return (
    /^(Alison Greenway Art|Designed by|Powered by|Terms and Conditions)$/i.test(text) ||
    /^P:\s*0405/i.test(text) ||
    /^E:\s*alisongreenwayart/i.test(text) ||
    text === "Specialising in House Art Commissions" ||
    /WebWave|Working Websites/i.test(text)
  );
}

function isValidParagraph(text: string) {
  if (text.length < 20 || text.length > 2000) return false;
  if (/Designed by|Powered by|WebWave|addEventListener|schema\.org|WWNamespace|function\s*\(|var process|\.ww_popup/i.test(text)) {
    return false;
  }
  if (/^[\{\[]|document\.|window\.|cache\.add/i.test(text)) return false;
  if (isFooterContent(text)) return false;
  return true;
}

function extractParagraphs(html: string, scope?: string) {
  const source = scope || html;
  const matches = source.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  return matches.map((m) => stripTags(m)).filter(isValidParagraph);
}

function extractBalancedDivInner(html: string, openTag: string, startIndex?: number) {
  const start = startIndex ?? html.indexOf(openTag);
  if (start < 0) return null;
  let cursor = start + openTag.length;
  let depth = 1;
  while (cursor < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }
    depth -= 1;
    cursor = nextClose + 6;
  }
  const innerStart = start + openTag.length;
  const innerEnd = cursor - 6;
  return html.slice(innerStart, innerEnd);
}

function extractTextWrappers(html: string) {
  const wrappers: string[] = [];
  const re = /<div class="ww_text_wrapper wwTextContent[^"]*"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const inner = extractBalancedDivInner(html, match[0], match.index);
    if (inner) wrappers.push(inner);
  }
  return wrappers;
}

function pageContentRegion(html: string) {
  const footerIndex = html.search(/id="footerGroup|footerGroup_en|Designed by/i);
  const sliceEnd = footerIndex >= 0 ? footerIndex : html.length;
  let start = html.search(/<h1[^>]*class="[^"]*news_element/i);
  if (start < 0) start = html.search(/<h1[^>]*>/i);
  return start >= 0 ? html.slice(start, sliceEnd) : html.slice(0, sliceEnd);
}

function isInfoBoxWrapper(html: string) {
  return /<h2[^>]*>\s*<strong>\s*Pricing\s*<\/strong>/i.test(html) || /All prices include 10% GST/i.test(html);
}

function isPriceTableWrapper(html: string) {
  return /<table/i.test(html) && /\bA[234]\b/i.test(html) && /\$\d+/.test(html) && !/<p[^>]*>[\s\S]{80,}/i.test(html);
}

function pickContentWrapper(wrappers: string[]) {
  const candidates = wrappers.filter((w) => !isInfoBoxWrapper(w) && !isPriceTableWrapper(w));
  return candidates.sort((a, b) => b.length - a.length)[0] || wrappers.sort((a, b) => b.length - a.length)[0];
}

function extractMainTextWrapper(html: string) {
  const region = pageContentRegion(html);
  const wrappers = extractTextWrappers(region);
  return pickContentWrapper(wrappers) || region;
}

function extractProductDescriptionWrapper(html: string) {
  const region = pageContentRegion(html);
  const wrappers = extractTextWrappers(region);
  return (
    wrappers.find((w) => /<p[^>]*>[\s\S]{40,}/i.test(w) && !isInfoBoxWrapper(w) && !isPriceTableWrapper(w)) ||
    pickContentWrapper(wrappers)
  );
}

function normalizeText(text: string) {
  return decodeHtml(text).replace(/\s+/g, " ").trim();
}

function parseImageTag(raw: string) {
  const src = raw.match(/\ssrc="([^"]+)"/i)?.[1];
  const alt = raw.match(/\salt="([^"]*)"/i)?.[1] || "";
  if (!src || /svg|gif;base64/i.test(src)) return null;
  return { src, alt };
}

function extractGiftVoucherTiers(html: string) {
  const tiers: Array<{ label: string; price: string; category: string }> = [];
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1]));
    if (cells.length >= 3 && /gift/i.test(cells[0])) {
      tiers.push({ label: cells[0], price: cells[1], category: cells[2] });
    }
  }
  return tiers;
}

function extractInfoBox(html: string) {
  const region = pageContentRegion(html);
  const infoWrapper = extractTextWrappers(region).find(isInfoBoxWrapper);
  if (infoWrapper) {
    const paragraphs = extractParagraphs(infoWrapper).filter(
      (p) => !/^fine giclee prints$/i.test(p)
    );
    const pricing = paragraphs.find((p) => /All prices include/i.test(p)) || "All prices include 10% GST";
    const shippingParts = paragraphs.filter(
      (p) =>
        /Packaging|Freight|Delivery|Australia Post/i.test(p) && !/All prices include/i.test(p)
    );
    const prints = paragraphs.find((p) => /Quality reproductions|Cotton Rag/i.test(p));
    if (pricing || shippingParts.length) {
      return {
        pricing,
        shipping: shippingParts.length
          ? shippingParts.join(" ")
          : "Packaging and freight are included for Australian orders.",
        prints
      };
    }
  }

  const pricing = html.match(/All prices include 10% GST/i) ? "All prices include 10% GST" : null;
  const shippingMatch = html.match(
    /Packaging[^<]*(?:Australia Post|premium, tracked)[^<.]*/i
  );
  const printsMatch = html.match(/Quality reproductions on 240 gsm[^<.]*/i);
  if (!pricing && !shippingMatch) return null;
  return {
    pricing: pricing || "All prices include 10% GST",
    shipping: shippingMatch
      ? decodeHtml(shippingMatch[0])
      : "Packaging and freight are included for Australian orders.",
    prints: printsMatch ? decodeHtml(printsMatch[0]) : undefined
  };
}

type ContentBlock = {
  type: string;
  text?: string;
  html?: string;
  items?: string[];
  src?: string;
  alt?: string;
};

function parseContentBlocks(content: string, pageUrl: string) {
  const blocks: ContentBlock[] = [];

  const blockRe =
    /<(h[2-4]|p|li|div|img)(\s[^>]*)?>([\s\S]*?)<\/\1>|<img([^>]+)\/?>/gi;
  let match: RegExpExecArray | null;
  let inList = false;
  let listItems: string[] = [];

  while ((match = blockRe.exec(content)) !== null) {
    const tag = match[1]?.toLowerCase();
    const raw = match[0];

    if (tag === "img" || raw.startsWith("<img")) {
      if (inList && listItems.length) {
        blocks.push({ type: "list", items: listItems });
        listItems = [];
        inList = false;
      }
      const image = parseImageTag(raw);
      if (image) {
        const abs = image.src.startsWith("http")
          ? image.src
          : new URL(image.src, pageUrl).href;
        blocks.push({ type: "image", src: abs, alt: image.alt });
      }
      continue;
    }

    const inner = match[3] || "";
    const text = stripTags(inner);

    if (tag === "p" || tag === "div") {
      const imgTag = inner.match(/<img[^>]+>/i)?.[0];
      const image = imgTag ? parseImageTag(imgTag) : null;
      if (image) {
        const abs = image.src.startsWith("http")
          ? image.src
          : new URL(image.src, pageUrl).href;
        blocks.push({ type: "image", src: abs, alt: image.alt });
        continue;
      }
    }

    if (!text || isFooterContent(text)) continue;

    if (tag === "li") {
      inList = true;
      listItems.push(text);
      continue;
    }

    if (inList && listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
      inList = false;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      if (/^pricing$|^shipping details$|^fine giclee prints$/i.test(text)) break;
      if (/^&nbsp;?$/.test(inner.trim()) || text.length < 3) continue;
      blocks.push({ type: "heading", text });
      continue;
    }

    if (tag === "p" || tag === "div") {
      if (!isValidParagraph(text)) continue;

      const formatted = inner
        .replace(/<strong>([^<]+)<\/strong>/gi, "<strong>$1</strong> ")
        .replace(/<a([^>]*)href="([^"]*)"([^>]*)>/gi, '<a$1href="$2"$3 class="text-link hover:underline">')
        .replace(/style="[^"]*color:var\(--userColor_1\)[^"]*"/gi, 'class="text-accent font-medium"')
        .replace(/<(?!\/?(?:a|strong)\b)[^>]+>/gi, "")
        .trim();

      blocks.push({
        type: "paragraph",
        text,
        html: formatted.includes("<strong>") || formatted.includes("<a ")
          ? formatted
          : undefined
      });
    }
  }

  if (listItems.length) blocks.push({ type: "list", items: listItems });
  return blocks;
}

function dedupeBlocks(blocks: ContentBlock[]) {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = [
      block.type,
      block.text || "",
      block.src || "",
      block.items?.join("|") || ""
    ].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractBlocksFromWrappers(wrappers: string[], pageUrl: string) {
  const blocks: ContentBlock[] = [];
  for (const wrapper of wrappers) {
    blocks.push(...parseContentBlocks(wrapper, pageUrl));
  }
  return dedupeBlocks(blocks);
}

function extractArticleBlocks(html: string, pageUrl: string) {
  const region = pageContentRegion(html);
  const wrappers = extractTextWrappers(region).filter(
    (w) => !isInfoBoxWrapper(w) && !isPriceTableWrapper(w)
  );
  if (wrappers.length) return extractBlocksFromWrappers(wrappers, pageUrl);
  return parseContentBlocks(extractMainTextWrapper(html), pageUrl);
}

function extractProductDescriptionBlocks(html: string, pageUrl: string) {
  const region = pageContentRegion(html);
  const wrappers = extractTextWrappers(region).filter(
    (w) => /<p[^>]*>[\s\S]{40,}/i.test(w) && !isInfoBoxWrapper(w) && !isPriceTableWrapper(w)
  );
  if (wrappers.length) return extractBlocksFromWrappers(wrappers, pageUrl);
  const wrapper = extractProductDescriptionWrapper(html);
  return wrapper ? parseContentBlocks(wrapper, pageUrl) : [];
}

async function hydrateBlockImages(blocks: ContentBlock[]) {
  for (const block of blocks) {
    if (block.type === "image" && block.src?.startsWith("http")) {
      const local = await downloadAsset(block.src);
      if (local) block.src = local;
    }
  }
}

function blogLeadFromHeadings(headings: Array<{ tag: string; text: string }>, h1: string) {
  const h2s = headings.filter((h) => h.tag === "h2" && h.text.trim());
  const lead = h2s.find((h) => h.text.length > 80 && h.text !== h1);
  return lead?.text || null;
}

function extractPrices(html: string) {
  const sizes: Array<{ label: string; price: number; dimensions: string }> = [];
  const a4 = html.match(/A4[^$]*\$(\d+)[^<]*(\d+cm\s*x\s*\d+cm)?/i);
  const a3 = html.match(/A3[^$]*\$(\d+)[^<]*(\d+cm\s*x\s*\d+cm)?/i);
  const a2 = html.match(/A2[^$]*\$(\d+)[^<]*(\d+cm\s*x\s*\d+cm)?/i);
  if (a4) sizes.push({ label: "A4", price: Number(a4[1]), dimensions: a4[2]?.trim() || "21cm x 30cm" });
  if (a3) sizes.push({ label: "A3", price: Number(a3[1]), dimensions: a3[2]?.trim() || "30cm x 42cm" });
  if (a2) sizes.push({ label: "A2", price: Number(a2[1]), dimensions: a2[2]?.trim() || "42cm x 60cm" });
  return sizes;
}

function mainProductImage(images: Array<{ src: string | null; alt: string; width: number }>) {
  const candidates = images
    .filter((img) => img.src?.startsWith("http") && !/logo|menu|arrow|bullet|facebook|instagram/i.test(img.alt))
    .sort((a, b) => b.width - a.width);
  return candidates[0]?.src || null;
}

function isBlogPostPage(slug: string, dom: string) {
  if (STATIC_TYPES[slug] || COLLECTION_SLUGS.has(slug)) return false;
  if (BLOG_POST_SLUGS.has(slug)) return true;
  if (!/class="[^"]*newspage/i.test(dom)) return false;
  if (extractPrices(dom).length > 0 || extractGiftVoucherTiers(dom).length > 0) return false;
  const wrapper = extractMainTextWrapper(dom);
  return wrapper.length > 400 && /<h2|<p/i.test(wrapper);
}

function detectType(slug: string, structure: any, dom: string) {
  if (STATIC_TYPES[slug]) return STATIC_TYPES[slug];
  if (COLLECTION_SLUGS.has(slug)) return "collection";
  if (isBlogPostPage(slug, dom)) return "blog-post";
  if (structure.headings?.some((h: any) => h.tag === "h2" && h.text === "Pricing")) return "product";
  if (extractPrices(dom).length > 0) return "product";
  return "content";
}

function collectionItems(structure: any, baseOrigin: string) {
  const items: Array<{ title: string; href: string; slug: string }> = [];
  for (const link of structure.links || []) {
    if (!link.href?.startsWith(baseOrigin)) continue;
    const p = new URL(link.href).pathname.replace(/^\//, "");
    if (!p || COLLECTION_SLUGS.has(p.replace(/\+/g, "-"))) continue;
    if (STATIC_TYPES[p.replace(/\+/g, "-")]) continue;
    const text = (link.text || "").trim();
    if (!text || text.length < 5) continue;
    const title = text.split(/A4\s*\$/)[0].trim();
    if (!title) continue;
    items.push({ title, href: urlToPath(link.href), slug: p });
  }
  return items;
}

function groupCollectionItems(items: Array<{ title: string; href: string; slug: string }>) {
  const groups: Record<string, Array<{ title: string; href: string; slug: string }>> = {};
  for (const item of items) {
    let key = "Collection";
    if (/\bB\s*&\s*W\b/i.test(item.title) || item.slug.endsWith("-bw")) key = "Black and White Collection";
    else if (/sepia/i.test(item.title) || item.slug.endsWith("-sepia")) key = "Sepia Collection";
    else if (/colour/i.test(item.title) || item.slug.endsWith("-colour")) key = "Colour Collection";
    (groups[key] ||= []).push(item);
  }
  return Object.entries(groups).map(([name, groupItems]) => ({ name, items: groupItems }));
}

async function main() {
  ensureDir(cmsRoot);
  ensureDir(assetsRoot);

  const pages: Record<string, any> = {};
  const seenPaths = new Set<string>();

  for (const entry of sitemap) {
    const pagePath = urlToPath(entry.url);
    if (seenPaths.has(pagePath)) continue;
    seenPaths.add(pagePath);

    const pageDir = path.join(sourceRoot, "pages", entry.slug);
    const structurePath = path.join(pageDir, "structure.json");
    const domPath = path.join(pageDir, "dom.html");
    if (!fs.existsSync(structurePath)) continue;

    const structure = JSON.parse(fs.readFileSync(structurePath, "utf8"));
    const dom = fs.existsSync(domPath) ? fs.readFileSync(domPath, "utf8") : "";
    const type = detectType(entry.slug, structure, dom);
    const paragraphs = extractParagraphs(dom);
    const h1 = structure.headings?.find((h: any) => h.tag === "h1")?.text || entry.title;

    const page: any = {
      slug: entry.slug,
      path: pagePath,
      type,
      seo: {
        title: structure.metadata?.title || entry.title,
        description: structure.metadata?.description || entry.description
      },
      heading: h1
    };

    if (type === "product") {
      const imgUrl = mainProductImage(structure.images || []);
      if (imgUrl) page.image = await downloadAsset(imgUrl);
      page.prices = extractPrices(dom);
      const blocks = extractProductDescriptionBlocks(dom, entry.url);
      await hydrateBlockImages(blocks);
      page.blocks = blocks;
      page.description = blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => b.text || "");
      page.infoBox = extractInfoBox(dom) || {
        pricing: "All prices include 10% GST",
        shipping:
          "Packaging and freight are included for Australian orders. Delivery is expected within 14 to 21 days via Australia Post premium tracked service.",
        prints: "Quality reproductions on 240 gsm premium textured Cotton Rag paper."
      };
    } else if (type === "collection") {
      const items = collectionItems(structure, "https://alisongreenwayart.com");
      page.groups = groupCollectionItems(items);
      const introBlocks = extractArticleBlocks(dom, entry.url).filter((b) => b.type === "paragraph");
      page.intro = introBlocks.map((b) => b.text || "").slice(0, 3);
      if (!page.intro.length) page.intro = paragraphs.slice(0, 2);
    } else if (type === "blog-list") {
      page.posts = (structure.links || [])
        .filter((l: any) => BLOG_POST_SLUGS.has(new URL(l.href).pathname.replace(/^\//, "")))
        .map((l: any) => {
          const raw = (l.text || "").split("Read more")[0].trim();
          const title = raw.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[a-z])(?=[A-Z])/)[0].trim();
          return { title, href: urlToPath(l.href) };
        });
    } else if (type === "blog-post") {
      page.lead = blogLeadFromHeadings(structure.headings || [], h1);
      let blocks = extractArticleBlocks(dom, entry.url);
      const heroImg = (structure.images || []).find(
        (img: any) =>
          img.src?.startsWith("http") &&
          img.width > 400 &&
          !/logo|menu/i.test(img.alt)
      );
      if (heroImg) {
        page.image = await downloadAsset(heroImg.src);
        page.imageAlt = heroImg.alt;
      }
      blocks = blocks.filter((block) => {
        if (
          page.lead &&
          block.type === "heading" &&
          normalizeText(block.text || "") === normalizeText(page.lead)
        ) {
          return false;
        }
        if (
          page.image &&
          block.type === "image" &&
          heroImg &&
          block.src?.includes(path.basename(new URL(heroImg.src).pathname))
        ) {
          return false;
        }
        return true;
      });
      await hydrateBlockImages(blocks);
      page.blocks = blocks;
      page.body = paragraphs;
    } else if (type === "gift-vouchers") {
      const imgUrl = mainProductImage(structure.images || []);
      if (imgUrl) page.image = await downloadAsset(imgUrl);
      page.voucherTiers = extractGiftVoucherTiers(dom);
      const voucherElementStart = dom.search(/<div id="element_336_content"/i);
      const voucherScope = voucherElementStart >= 0
        ? extractTextWrappers(dom.slice(voucherElementStart))[0]
        : undefined;
      const voucherParagraphs = extractParagraphs(dom, voucherScope).filter(
        (p) => !/All prices include|Packaging and Freight|Expected Order Delivery|Fine Giclee|shipped via Australia Post|Quality reproductions on 240/i.test(p)
      );
      page.description = voucherParagraphs.map((p) => {
        if (/cannot be used when purchasing/i.test(p)) {
          return `<span class="text-accent">Gift Vouchers cannot be used when purchasing online. To redeem your Gift Voucher contact Alison Greenway Art on</span> <a href="tel:0405179479" class="text-link hover:underline">0405 179 479</a>`;
        }
        return p;
      });
      page.infoBox = extractInfoBox(dom);
    } else if (type === "home") {
      page.hero = {
        line1: "Custom Hand Drawn",
        line2: "House Portrait Art",
        line3: "By Alison Greenway",
        cta: { label: "Commission a House Portrait", href: "/house-portrait-commissions" }
      };
      const footerIndex = dom.search(/footerGroup|Designed by/i);
      const homeRegion = dom.slice(0, footerIndex >= 0 ? footerIndex : dom.length);
      const homeParagraphs = extractTextWrappers(homeRegion)
        .filter((w) => !isInfoBoxWrapper(w) && !isFooterContent(stripTags(w)))
        .flatMap((w) => extractParagraphs(w));
      page.sections = [...new Set(homeParagraphs)].filter(isValidParagraph);
      if (!page.sections.length) page.sections = paragraphs;
      const imgs = (structure.images || []).filter((i: any) => i.src?.startsWith("http") && i.width > 400);
      page.images = [];
      for (const img of imgs.slice(0, 8)) {
        const local = await downloadAsset(img.src);
        if (local) page.images.push({ src: local, alt: img.alt });
      }
    } else {
      const blocks = extractArticleBlocks(dom, entry.url);
      await hydrateBlockImages(blocks);
      page.blocks = blocks;
      page.body = blocks
        .filter((b) => b.type === "paragraph" || b.type === "heading")
        .map((b) => b.text || "")
        .filter(Boolean);
      if (!page.body.length) page.body = paragraphs;
      const hero = mainProductImage(structure.images || []);
      if (hero) page.image = await downloadAsset(hero);
    }

    pages[pagePath] = page;
  }

  // Shared assets
  const logoUrl =
    "https://alisongreenwayart.com/lib/y7gow9/Greenway-Art-Logo-Transparent-lpw6c13y.png";
  const logo = await downloadAsset(logoUrl);

  const site = {
    name: "Alison Greenway Art",
    phone: "0405 179 479",
    email: "alisongreenwayart@gmail.com",
    logo,
    social: {
      facebook: "https://www.facebook.com/AlisonGreenwayArt/",
      instagram: "https://www.instagram.com/alisongreenway_art"
    },
    nav: [
      { label: "Home", href: "/" },
      {
        label: "Quality Reproductions",
        href: "/queensland-homes",
        children: [
          { label: "Queensland Homes Collection", href: "/queensland-homes" },
          { label: "Queensland Cottages Collection", href: "/queensland+cottage+art+collection" },
          { label: "Painting Reproductions", href: "/painting-reproductions" }
        ]
      },
      { label: "Art Commissions", href: "/house-portrait-commissions" },
      { label: "Gift Vouchers", href: "/gift-vouchers" },
      { label: "Alison's Blog", href: "/alisons-blog" },
      { label: "About", href: "/about+alison+greenway" },
      { label: "Contact", href: "/contact+alison+greenway" }
    ],
    footerNav: [
      { label: "Home", href: "/" },
      { label: "Quality Reproductions", href: "/queensland-homes" },
      { label: "Commissions", href: "/house-portrait-commissions" },
      { label: "Gift Vouchers", href: "/gift-vouchers" },
      { label: "Alison's Blog", href: "/alisons-blog" },
      { label: "About", href: "/about+alison+greenway" },
      { label: "Contact", href: "/contact+alison+greenway" }
    ],
    integrations: {
      ecommerce: "WebWave store with Stripe checkout (requires WWS e-commerce integration)",
      video: "Embedded promotional video on homepage (YouTube - needs embed URL from live site)",
      analytics: "Google Tag Manager (not recreated in static build)"
    }
  };

  const blogPosts = Object.values(pages)
    .filter((p) => p.type === "blog-post")
    .map((p) => ({ title: p.heading, href: p.path }));
  if (pages["/alisons-blog"] && blogPosts.length) {
    pages["/alisons-blog"].posts = blogPosts;
  }

  for (const page of Object.values(pages)) {
    if (page.type !== "collection" || !page.groups) continue;
    for (const group of page.groups) {
      for (const item of group.items) {
        const product = pages[item.href];
        if (product?.image) item.image = product.image;
      }
    }
  }

  fs.writeFileSync(path.join(cmsRoot, "site.json"), JSON.stringify(site, null, 2));
  fs.writeFileSync(path.join(cmsRoot, "pages.json"), JSON.stringify(pages, null, 2));
  fs.writeFileSync(path.join(cmsRoot, "asset-map.json"), JSON.stringify(Object.fromEntries(assetMap), null, 2));
  console.log(
    `Prepared ${Object.keys(pages).length} pages and ${assetMap.size} assets into ${websiteDir}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
