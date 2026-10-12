# WWS ingestion acceptance

Astro/CMS validation checks the source repository. It cannot certify that the GitHub importer preserves content or layout. Use the actual reviewed converter separately:

```sh
npm run check:ingestion -- \
  --wws-dir=/path/to/ww-studio \
  --website-dir=../client-recreation-wws \
  --config=sites/client.json
```

The WWS checkout must contain `project/scripts/check-github-import.mjs` (shared importer fix: https://github.com/working-websites/ww-studio/pull/66), with dependencies installed in project/. Node 24 and this pipeline's Playwright browser installation are required. Missing tooling is a failure, never a fallback to structural checks.

The checker evaluates source statically, enforces real fetch limits and produces the actual native canvas renderer preview without credentials or database access. It does not run the client repository's scripts. The pipeline also verifies CMS route coverage and captures native output at 1280/768/390 and the source capture widths 1440/1024, recording visible broken images, raw expressions and horizontal overflow.

Artifacts live in ignored `recreation/ingestion/<client>/`: report.json, canvas.json, native HTML/local assets, render-check.json and full-page screenshots. Source and importer hashes/dirty flags identify the exact tested inputs. Source changes and converter changes invalidate earlier acceptance; rerun before acceptance.

Exit codes: 0 = conversion checks passed; 1 = blocker/smoke failure; 2 = layout review required. `--allow-review=true` permits review artifact generation, not import approval. The report and render-check keep visualFidelityApproved=false and interactionsVerified=false. A source-only CI green check is never ingestion proof.

Compare the native preview against source captures including full-page heights and section order. WWS uses 1024/640/390 content columns and 1280/768/390 device modes, which differ from many originals. Register custom fonts, validate deployed asset access and correct unsupported CSS. Static previews block remote requests and do not hydrate form/menu/gallery actions or external embeds. Verify those separately on a disposable WWS site after the reviewed importer is deployed. Never edit a real client or treat unverified integration behavior as passing.

Beyond Books currently passes all seven route/content checks and 35 renderer smoke captures but remains needs-review for width/fonts/CSS/interactions. The earlier import-ready claim is withdrawn.
