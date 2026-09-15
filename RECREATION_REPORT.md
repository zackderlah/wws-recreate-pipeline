# Recreation Report — Alison Greenway Art

**Source:** https://alisongreenwayart.com  
**Captured:** 2026-09-15 (47 unique pages within 50-page crawl limit)  
**Stack:** Astro 7 + TypeScript + Tailwind CSS 4  
**Site output:** `website/dist/`

---

## Pages recreated

All **47 captured pages** were recreated with original URL paths preserved (including `+` segments such as `/about+alison+greenway`).

| Type | Count | Examples |
|------|------:|----------|
| Home | 1 | `/` |
| Collection | 3 | `/queensland-homes`, `/queensland+cottage+art+collection`, `/painting-reproductions` |
| Product / shop | 33 | `/double-gabled-suburban-home-bw`, `/toucan-in-the-jungle`, … |
| Commissions | 1 | `/house-portrait-commissions` |
| Gift vouchers | 1 | `/gift-vouchers` |
| Blog list | 1 | `/alisons-blog` |
| Blog posts | 3 | `/the-bull-and-barley-inn-cambooya`, … |
| About / contact / terms | 3 | `/about+alison+greenway`, `/contact+alison+greenway`, `/terms-and-conditions` |

### CMS pattern

Editable content lives in WWS CMS JSON fields under `website/src/cms/`:

- `site.json` — site name, logo, phone, email, social links, navigation
- `pages.json` — per-page SEO, headings, body copy, product prices, collection grids, images

Layout, typography, colours, and responsive structure are implemented in Astro components (`website/src/components/`, `website/src/layouts/`).

---

## Visual QA status

| Metric | Result |
|--------|--------|
| Build | ✅ `npm run build:site` succeeds (47 static routes) |
| Screenshots | ✅ 47 pages × 3 viewports → `recreation/generated/pages/<slug>/<viewport>.png` |
| Comparison | ✅ `npm run compare` → `recreation/diff-report.json` + `recreation/diff/` |
| QA passes | 4 (capture fix, content/filter + compare crop, collection layout polish, site-wide block extraction) |

**Pass 3 summary (141 viewport comparisons, after site-wide content fixes):**

- Average pixel diff ratio: **21.9%**
- Viewports under 20% diff: **~78 / 141** (55%)
- Viewports under 40% diff: **~137 / 141** (97%)

**Pass 3 improvements:**

- Generalized WebWave content extraction (`<div>` blocks, balanced wrapper parsing, image `alt`/`src` order) across **all page types**
- Shared `ArticleBlocks.astro` component used by product, content, and blog templates
- Product pages: full story descriptions + responsive two-column layout (matching gift vouchers)
- Commissions / about / terms: multi-section content from all text wrappers (headings, lists, links)
- Blog list auto-populated from detected blog-post pages

**Strongest matches (page average):**

- `gift-vouchers` ~11%
- Product pages ~14–24% (content-complete; layout aligned)
- Blog posts ~20–22%

**Largest remaining gaps:**

- `painting-reproductions` (~59%) — dense 16-item gallery grid layout differs from simplified Tailwind grid
- `home` (~37%) — homepage video section, feature grid typography, and hero spacing not fully matched
- Collection index pages (`queensland-homes`, `queensland-cottage-art-collection`) ~32–34% — grid density and header styling

Diff images are in `recreation/diff/` for human review.

---

## Forms & integrations

| Integration | Source behaviour | Recreation status |
|-------------|------------------|-------------------|
| **WebWave e-commerce / Stripe** | Add to Cart, cart icon, Stripe checkout in `pageData` | ⚠️ **Flagged** — UI shows “Add to Cart” buttons; checkout/cart requires WWS e-commerce + Stripe wiring |
| **Contact** | Contact details on page | ✅ Contact page with mailto form fallback; needs WWS form handler for production |
| **YouTube video** | Embedded promo video on homepage | ⚠️ **Flagged** — not embedded (embed URL not extracted cleanly from capture) |
| **Google Tag Manager** | Analytics in source DOM | ⚠️ Intentionally omitted (not part of visual recreation) |
| **Facebook / Instagram** | Social links | ✅ Recreated in header/footer |
| **PDF download** | House portrait guidelines PDF linked from commissions | ⚠️ Not captured (PDF navigation failed during crawl) |

---

## Missing assets

- **48 images** downloaded to `website/public/assets/` from capture (logos, product art, category thumbnails).
- Assets on `yourbrand-18274.kxcdn.com` CDN were used where referenced in capture; not all CDN variants downloaded.
- **Additional site pages** beyond the 50-page crawl limit were not captured (sitemap may be incomplete vs live site).
- House portrait guidelines PDF (`/lib/y7gow9/05-House-Portrait-Image-Guidelines-*.pdf`) failed capture (download response).

---

## Remaining differences

1. **Homepage** — missing video block; feature grid uses simplified two-column text instead of titled feature cards; minor hero/section spacing differences.
2. **Collection pages** — product grid column counts and green section bars approximate but not pixel-identical to WebWave layout.
3. **Commissions page** — image carousel / multi-step layout simplified to content page.
4. **Product pages** — duplicate shipping/pricing copy removed from body (kept in info box); minor font-weight and spacing variance.
5. **Footer** — “Powered by WebWave” credit removed (WWS-native site); “Designed by Working Websites” retained.
6. **Mobile navigation** — hamburger menu implemented; hover dropdown on desktop replaces WebWave menu behaviour.

---

## Human review required

1. **E-commerce** — Connect Stripe / cart flow to replace non-functional Add to Cart buttons.
2. **Homepage video** — Provide YouTube embed URL or asset for faithful hero/media section.
3. **Contact form** — Wire to WWS form submission endpoint (currently mailto fallback).
4. **PDF asset** — Add house portrait guidelines PDF to CMS and link from commissions page.
5. **Uncaptured pages** — Re-run capture with higher `WWS_MAX_PAGES` if full site parity is required.
6. **Visual sign-off** — Review `recreation/diff/` for brand-critical pages (home, collections, top products).

---

## Commands

```bash
# Regenerate CMS data + build
npm run build:site

# Preview recreated site
cd website && npx astro preview --host --port 4321

# QA screenshots (preview must be running)
npm run screenshot

# Visual diff
npm run compare
```

---

## Pipeline fixes applied

- Fixed Playwright `page.evaluate` failure (`__name` / tsx) in `src/capture.ts` so automated capture works on Windows.
- Added `src/screenshot.ts` Playwright QA script.
- Updated `src/compare.ts` to crop to common dimensions before pixel comparison.
