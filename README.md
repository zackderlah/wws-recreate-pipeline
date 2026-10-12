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

Codex reads `AGENTS.md`, which applies the same WWS import and fidelity rules.

## CopyAnything / Pingfusi

Pingfusi is pinned as a development tool for source-vs-draft human review:

```bash
npm run pingfusi:setup
npm run pingfusi:doctor
npm run review:prepare -- --config=sites/alisongreenwayart.json
```

Use Node 24 LTS and complete the device login during setup. The review preparation
command creates a local brief after capture; it never uploads or submits a review.
Read [the WWS integration guide](docs/pingfusi.md) for adopted targets, publishing,
review scopes and preserving the WWS CMS architecture.

## Adding another site

1. Copy `sites/alisongreenwayart.json` → `sites/<new-client>.json`
2. Create a new Astro site repo (or use a scaffold from an existing recreation)
3. Run capture + `prepare:site` with `--config` and `--website-dir`
4. Commit and push the **site repo** only


WWS ingestion is a separate required gate. Run `npm run check:ingestion -- --wws-dir=/path/to/ww-studio --website-dir=../client-recreation-wws --config=sites/client.json` against the actual reviewed WWS converter. Read [the ingestion acceptance rules](.cursor/rules/wws-github-import.mdc). Source builds and CMS/file checks alone do not establish import readiness. A `needs-review` result must remain unverified until the native WWS layout and interactions have been compared.
