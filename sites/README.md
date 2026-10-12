# Site configs

One JSON file per recreated site. Passed to `prepare:site`:

```bash
tsx scripts/prepare-site.ts --config=sites/alisongreenwayart.json --website-dir=../alisongreenwayart-recreation-wws
```

Fields:

- `id` — short site identifier
- `sourceUrl` — original site URL
- `collectionSlugs` — collection index page slugs
- `blogPostSlugs` — blog article slugs (or rely on auto-detection)
- `staticTypes` — slug → page template type overrides
- `adapter` — optional dedicated content importer (`beyondbooks` is currently supported)

Beyond Books uses a dedicated adapter so its site metadata, media, structured text
and form configuration do not inherit the original Alison Greenway importer’s data:

```bash
npm run recreate -- https://www.beyondbooks.net.au/
npm run prepare:site -- --config=sites/beyondbooks.json --website-dir=../beyondbooks-recreation-wws
```

Capture stores `recreation/source/measurements.json` beside the screenshots to
preserve rendered responsive asset variants and source SVG icons. The adapter uses
these as import evidence; it never exposes measurements as editable CMS fields.
