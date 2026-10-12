# WWS recreation workflow

This repository contains reusable capture and QA tooling. Deployable client sites
belong in separate sibling repositories, selected with `sites/<client>.json` and
`--website-dir`. Do not scaffold a client website in this pipeline repository.

Before any import or recreation, read `.cursor/rules/wws-recreation.mdc` and
`prompts/recreate-site.md` and `.cursor/rules/wws-github-import.mdc`. The GitHub import contract takes precedence over legacy pipeline output shapes. These WWS rules also apply in Codex. Source screenshots
are the visual authority; preserve content, URLs, assets, responsive behavior and
interactions. Build clean Astro/TypeScript/Tailwind components, keep layout in
code and expose non-structural editable content through WWS CMS fields.

## CopyAnything / Pingfusi

Read `docs/pingfusi.md` before using Pingfusi. Use it alongside WWS capture and
visual QA. For an existing WWS build, use `pingfusi adopt`, rather than replacing
the site with Pingfusi's captured DOM or `capture-build` output. Its reviewers
judge rendered fidelity; their suggestions must preserve WWS architecture and
the source design. Do not redesign based on subjective taste feedback.

Run the site build, then WWS screenshots and comparison at 1440, 1024 and 390 px.
Prepare a local review brief with `npm run review:prepare -- --config=sites/<client>.json`.
Publishing a draft and filing a credit-consuming human review require authorization
for that client review. Setup alone does not authorize publishing client content.
When a review is authorized, use concrete page/viewport scopes, record pinned
findings, fix them and rerun the local checks. Limit the full QA/fix cycle to three
passes; report unresolved findings rather than continuing indefinitely.

Do not claim pixel-perfect completion from a marketing promise, a diff average or
a reviewer verdict alone. Report build results, page/viewport coverage, dimension
differences, visual findings, interactions, missing assets and integrations in
the client site's `RECREATION_REPORT.md`. If the Pingfusi login or MCP is unavailable,
continue local WWS QA and report external review as pending.


WWS ingestion is a separate required gate. Run `npm run check:ingestion -- --wws-dir=/path/to/ww-studio --website-dir=../client-recreation-wws --config=sites/client.json` against the actual reviewed WWS converter. Read [the ingestion acceptance rules](.cursor/rules/wws-github-import.mdc). Source builds and CMS/file checks alone do not establish import readiness. A `needs-review` result must remain unverified until the native WWS layout and interactions have been compared.
