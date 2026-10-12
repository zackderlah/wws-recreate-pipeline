Recreate the website at:

{{SOURCE_URL}}

The automated capture has already been generated in:

`recreation/source/`

Do not ask me to manually provide screenshots or page content unless extraction clearly failed.

## Process

1. Read `AGENTS.md` and `.cursor/rules/wws-recreation.mdc`.
2. Inspect:
   - `recreation/source/sitemap.json`
   - every `structure.json`
   - desktop/tablet/mobile screenshots
   - downloaded assets
3. Recreate every captured page.
4. Preserve existing URLs.
5. Use original assets where available.
6. Follow the WWS CMS integration pattern for non-structural editable content.
7. Detect forms, embeds and third-party integrations and recreate or explicitly flag them.
8. Build the project.
9. Create a Playwright QA script that renders the recreated pages into:
   `recreation/generated/pages/<page>/<viewport>.png`
10. Run `npm run compare`.
11. Inspect `recreation/diff-report.json` and visual diff images.
12. Fix meaningful discrepancies.
13. Repeat QA/fixes for up to 3 passes.
14. Stop if further changes risk regressions or differences are trivial.
15. Produce `RECREATION_REPORT.md` containing:
   - pages recreated
   - visual QA status
   - forms/integrations
   - missing assets
   - remaining differences
   - anything requiring human review

Important:
- Do not redesign.
- Do not reproduce WebWave's generated implementation.
- Rebuild cleanly while matching the rendered result.
- Do not claim completion until the project builds and QA has run.

When using CopyAnything/Pingfusi:
- Read `docs/pingfusi.md` and use the existing WWS build as an adopted target.
- Run `npm run review:prepare -- --config=sites/<client>.json` after local QA.
- Once client publishing/review is authorized, publish the built client output
  and request source-vs-draft review with explicit page and viewport scopes.
- Fix pinned fidelity/interaction findings while keeping WWS CMS integration.
- Keep the total QA/fix cycle within the three-pass limit above.
- Include the human verdict or pending review status in `RECREATION_REPORT.md`.


WWS ingestion is a separate required gate. Run `npm run check:ingestion -- --wws-dir=/path/to/ww-studio --website-dir=../client-recreation-wws --config=sites/client.json` against the actual reviewed WWS converter. Read [the ingestion acceptance rules](.cursor/rules/wws-github-import.mdc). Source builds and CMS/file checks alone do not establish import readiness. A `needs-review` result must remain unverified until the native WWS layout and interactions have been compared.
