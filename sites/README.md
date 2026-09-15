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
