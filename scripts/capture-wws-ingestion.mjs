// Capture actual WWS-rendered import output; never fetch or modify a WWS site.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const index = arg.indexOf('='); return [arg.slice(2, index), arg.slice(index + 1)]; }));
if (!args.dir) throw new Error('Usage: node scripts/capture-wws-ingestion.mjs --dir=recreation/ingestion/client');
const root = await fs.realpath(path.resolve(args.dir));
const canvas = JSON.parse(await fs.readFile(path.join(root, 'canvas.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(path.join(root, 'report.json'), 'utf8'));
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const server = http.createServer(async (request, response) => {
  try {
    let target = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
    target = await fs.realpath(target);
    if (!target.startsWith(root + path.sep)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream');
    response.end(await fs.readFile(target));
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  // This is a static renderer smoke test. It must never invoke remote APIs.
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const rows = [];
  for (const route of canvas.filter(page => !page.isSharedElements)) {
    for (const [label, width, height] of [['desktop',1280,900],['tablet',768,1024],['mobile',390,844],['source-desktop',1440,900],['source-tablet',1024,768]]) {
      await page.setViewportSize({width,height});
      await page.goto(origin + (route.slug === '/' ? '/' : route.slug + '/'));
      await page.evaluate(async () => { for (const image of document.images) image.loading = 'eager'; await Promise.race([Promise.all([...document.images].map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 10000))]); await document.fonts.ready; });
      const evidence = await page.evaluate(() => {
        const visibleImages = [...document.images].filter(image => { const bounds=image.getBoundingClientRect(); return bounds.width > 0 && bounds.height > 0 && image.checkVisibility(); });
        return { fullPageHeight:document.documentElement.scrollHeight, visibleImages:visibleImages.length, brokenImages:visibleImages.filter(image => !image.complete || !image.naturalWidth).map(image => image.getAttribute('src')), rawExpressions:/\{\s*(?:video|image|page|block|run)\b|\.map\(/.test(document.body.innerText), horizontalOverflow:document.documentElement.scrollWidth > innerWidth };
      });
      const slug = route.slug.replace(/^\/+|\/+$/g,'') || 'home';
      const destination = path.join(root,'screenshots',slug);
      await fs.mkdir(destination,{recursive:true});
      const image = path.join(destination,label+'.png');
      await page.screenshot({path:image,fullPage:true});
      rows.push({route:route.slug,label,width,height,...evidence,image:path.relative(root,image)});
    }
  }
  const failed = rows.filter(row => row.brokenImages.length || row.rawExpressions || row.horizontalOverflow);
  const evidence = {schemaVersion:1,sourceHash:report.sourceHash,importerCommit:report.importerCommit,importerDirty:report.importerDirty,checkedAt:new Date().toISOString(),staticOnly:true,interactionsVerified:false,visualFidelityApproved:false,status:failed.length?'failed':'smoke-passed',rows};
  await fs.writeFile(path.join(root,'render-check.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(`Native WWS renderer: ${rows.length} page/viewport captures; ${failed.length} smoke failures. Layout approval and interactions remain separate gates.`);
  if(failed.length) process.exitCode=1;
} finally { if(browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
