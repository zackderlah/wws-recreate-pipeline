# WWS Recreation Pipeline

Reusable capture + recreation workflow for migrating WebWave sites into WWS.

## Setup

```bash
npm install
npm run install:browsers
```

## Capture + start recreation

```bash
npm run recreate -- https://example.com
```

This automatically:

1. crawls same-origin pages
2. auto-scrolls lazy content
3. captures desktop/tablet/mobile full-page screenshots
4. saves rendered HTML
5. extracts headings, links, images, forms, metadata and section geometry
6. downloads accessible image assets
7. creates a structured site manifest
8. prints the master Cursor/Codex recreation prompt

## Output

```text
recreation/
  source/
    sitemap.json
    site-data.json
    assets/
    pages/
      home/
        desktop.png
        tablet.png
        mobile.png
        dom.html
        structure.json
  generated/
  diff/
  diff-report.json
```

## Cursor workflow

Open the repository in Cursor and paste:

`prompts/recreate-site.md`

The global recreation rules live in:

`.cursor/rules/wws-recreation.mdc`

## Visual comparison

Once the recreated website's QA screenshots exist in
`recreation/generated/pages/...` run:

```bash
npm run compare
```

This creates pixel diffs and `recreation/diff-report.json`.

## Recommended production additions

Before using this for all 60+ sites, add:

- robots/rate-limit controls
- sitemap.xml parsing before link crawling
- font/background-image downloading
- carousel interaction capture
- iframe/integration inventory
- screenshot masking for dynamic content
- a WWS CMS schema generator
- GitHub repo creation via `gh`
- WWS API registration after migration approval

Start with 3 representative WebWave sites and improve the pipeline before batch migration.
