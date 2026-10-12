import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).filter(arg => arg.startsWith('--') && arg.includes('=')).map(arg => { const at = arg.indexOf('='); return [arg.slice(2, at), arg.slice(at + 1)]; }));
if (!args['wws-dir'] || !args['website-dir'] || !args.config) {
  throw new Error('Usage: npm run check:ingestion -- --wws-dir=/path/to/ww-studio --website-dir=../client-site --config=sites/client.json [--allow-review=true]');
}
const config = JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8'));
if (!/^[a-z0-9-]+$/.test(config.id)) throw new Error('Invalid site id.');
const checkout = path.resolve(args['wws-dir']);
const project = fs.existsSync(path.join(checkout, 'project/src/utils/githubSiteImport.ts')) ? path.join(checkout, 'project') : checkout;
const checker = path.join(project, 'scripts/check-github-import.mjs');
if (!fs.existsSync(checker)) throw new Error('This WWS checkout does not provide the actual ingestion checker. Update it to the reviewed importer fix; do not substitute source/build checks.');
const out = path.resolve('recreation/ingestion', config.id);
const run = spawnSync(process.execPath, [checker, '--website-dir', path.resolve(args['website-dir']), '--out', out, '--allow-review', args['allow-review'] === 'true' ? 'true' : 'false'], { cwd: project, stdio: 'inherit' });
if (run.error) throw run.error;
if (run.status === null) throw new Error(`Ingestion checker terminated (${run.signal}).`);
if (run.status === 0 || run.status === 2) {
  const capture = spawnSync(process.execPath, [path.resolve('scripts/capture-wws-ingestion.mjs'), `--dir=${out}`], { stdio: 'inherit' });
  if (capture.error) throw capture.error;
  if (capture.status !== 0) process.exit(capture.status ?? 1);
}
const reportPath = path.join(out, 'report.json');
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const expected = Object.keys(JSON.parse(fs.readFileSync(path.resolve(args['website-dir'], 'src/cms/content.json'), 'utf8')).pageContent ?? {});
  const canvas = JSON.parse(fs.readFileSync(path.join(out, 'canvas.json'), 'utf8'));
  const actual = new Set(canvas.filter(page => !page.isSharedElements).map(page => page.slug));
  const missing = expected.filter(slug => !actual.has(slug));
  if (missing.length) { console.error(`Missing CMS routes: ${missing.join(', ')}`); process.exit(1); }
  console.log(`Ingestion evidence: ${reportPath}\nImporter: ${report.importerCommit}${report.importerDirty ? ' (local changes)' : ''}\nStatus: ${report.status}. A build result is not proof of WWS fidelity.`);
}
process.exitCode = run.status;
