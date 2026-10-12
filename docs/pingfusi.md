# CopyAnything + WWS

[CopyAnything](https://copy-anything.com) uses the
[Pingfusi toolkit](https://github.com/alex-durango/pingfusi). It combines capture
utilities with independent human review of published drafts. This pipeline pins
Pingfusi 0.18.0 as a development tool; it is not a dependency of client websites.

## Setup

Use Node 24 LTS with npm/npx available on PATH, then run:

```bash
npm ci
npm run pingfusi:setup       # equivalent to npx pingfusi setup codex
npm run pingfusi:doctor
npm run install:browsers    # WWS screenshot runtime
```

Setup asks about optional global installation and motion capture, then requires
you to approve an account device code. A global installation is optional when
using these npm scripts. Use `npm run pingfusi -- <command>` for toolkit commands.
For animation capture, install the optional runtime with
`npm run pingfusi -- motion install-browser`.

The installer writes Codex's user MCP configuration and agent skills. Keep login
credentials outside Git. Reopen the Codex session if the newly configured tools
are not available. To configure Cursor too: `npm run pingfusi -- setup cursor`.
The supported commands are documented in the upstream
[command reference](https://github.com/alex-durango/pingfusi/blob/main/docs/COMMANDS.md).

## Import, build and local QA

1. Capture with `npm run recreate -- https://example.com`.
2. Follow `prompts/recreate-site.md` and `.cursor/rules/wws-recreation.mdc`.
3. Import content into the selected sibling Astro site with `prepare:site`.
4. Build and serve that site. Set `PREVIEW_URL` if its preview is not port 4321.
5. Run `npm run screenshot` and `npm run compare`; inspect the actual source,
   generated and diff images for every page at 1440, 1024 and 390 px.
6. Run `npm run review:prepare -- --config=sites/<client>.json` to write a local
   `recreation/review/brief.md` with page URLs, evidence coverage and WWS constraints.

The brief is local preparation: it does not publish a site or file a review.
Recapture and compare after changes so its evidence is current. Pixel ratios are
diagnostic, not acceptance thresholds; the current comparator crops unequal
images to their common area, so check full-page dimensions and missing sections
separately. Human review supplements this evidence.

## Review an existing WWS build

Once publishing and human review are authorized for the client, register the WWS
build using an adopted target. Run these commands from this pipeline folder:

```bash
npm run pingfusi -- adopt <client> https://example.com 1440
npm run pingfusi -- publish ../<client-repo>/dist --target <client>
npm run pingfusi -- review <client> file --region "Home page: header and hero at 1440px" --context "<relevant brief text>"
```

Adopt only once per target. Continue an existing target instead of recreating it.
Publish the client's built output, not this pipeline or its source captures.
Confirm the output is self-contained, including local assets and fonts; an Astro
SSR site needs an appropriate running preview instead of a static `dist` upload.
For more pages or widths, explicitly include their routes and required widths in
the review scope/context; a 1440px target alone does not prove tablet/mobile QA.
The CLI context flag takes text, not a filename: include relevant brief sections
through the MCP request or as a properly quoted argument.

Use reviewer findings to fix spacing, typography, image cropping, section heights,
navigation, responsive layout and motion while preserving WWS CMS boundaries.
Do not use `capture-build` as the WWS implementation: importing the source DOM
conflicts with the clean WWS-native rebuild rule. After fixes, rebuild, rerun local
QA and republish before refiling with `--changelog "<fixes>"`. Stop after three
QA passes and record any remaining findings, pending review and human verdicts
in the client site's recreation report. Review rounds require login and credits.
