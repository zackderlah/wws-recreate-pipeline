# WWS Recreation Pipeline

Reusable capture + QA tooling for migrating WebWave sites into WWS-native Astro sites.

Each **client website** lives in its own repository. This repo holds only the pipeline.

## Layout

Clone site repos as siblings of this pipeline:

```text
wws-recreate-pipeline/              # this repo (tooling)
alisongreenwayart-recreation-wws/ # site repo (deployable Astro project)
```

## Setup

```bash
npm install
npm run install:browsers
cd ../alisongreenwayart-recreation-wws && npm install
```

## Capture a site

```bash
npm run recreate -- https://example.com
```

Output is written to `recreation/source/` (local only, not committed).

## Generate CMS + build site

```bash
npm run prepare:site   # writes to ../alisongreenwayart-recreation-wws
npm run build:site
```

Site config: `sites/alisongreenwayart.json`. Add a new JSON file per client and pass `--config=sites/<client>.json --website-dir=../<client-repo>`.

## Visual QA

```bash
npm run qa
npm run screenshot
npm run compare
```

## Cursor workflow

Paste `prompts/recreate-site.md` after capture. Rules: `.cursor/rules/wws-recreation.mdc`.

## Adding another site

1. Copy `sites/alisongreenwayart.json` → `sites/<new-client>.json`
2. Create a new Astro site repo (or use a scaffold from an existing recreation)
3. Run capture + `prepare:site` with `--config` and `--website-dir`
4. Commit and push the **site repo** only
