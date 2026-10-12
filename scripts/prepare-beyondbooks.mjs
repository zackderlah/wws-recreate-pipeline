import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
const arg=(name)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const out=path.resolve(arg('website-dir')||'../beyondbooks-recreation-wws');
const source=path.resolve('recreation/source');
const sitemap=JSON.parse(fs.readFileSync(path.join(source,'sitemap.json')));
if(sitemap.some(x=>new URL(x.url).hostname!=='www.beyondbooks.net.au'))throw Error('Capture is not Beyond Books');
fs.mkdirSync(path.join(out,'public/assets'),{recursive:true});fs.mkdirSync(path.join(out,'src/cms'),{recursive:true});
const assetMap={};
const measurements=JSON.parse(fs.readFileSync(path.join(source,'measurements.json')));

async function asset(url){
 if(!url)return null; if(url.startsWith('data:image/svg+xml,')){const svg=decodeURIComponent(url.slice('data:image/svg+xml,'.length));const name=crypto.createHash('sha1').update(svg).digest('hex').slice(0,10)+'.svg';fs.writeFileSync(path.join(out,'public/assets',name),svg);return '/assets/'+name;} if(url.startsWith('data:'))return url;
 url=new URL(url,'https://www.beyondbooks.net.au').href;
 if(assetMap[url])return assetMap[url];
 const name=crypto.createHash('sha1').update(url).digest('hex').slice(0,10)+'-'+path.basename(new URL(url).pathname).replace(/[^\w.-]/g,'_');
 const dest=path.join(out,'public/assets',name);
 if(!fs.existsSync(dest)){const res=await fetch(url);if(!res.ok)throw Error(`Asset ${res.status}: ${url}`);fs.writeFileSync(dest,Buffer.from(await res.arrayBuffer()));}
 return assetMap[url]='/assets/'+name;
}
const browser=await chromium.launch();const tab=await browser.newPage();const captured={};
for(const entry of sitemap){
 const html=fs.readFileSync(path.join(source,'pages',entry.slug,'dom.html'),'utf8');
 const body=html.slice(html.indexOf('<body')).replace(/<script\b[\s\S]*?<\/script>/gi,'');
 await tab.setContent(body,{waitUntil:'domcontentloaded'});
 const data=await tab.evaluate(()=>{
  const text=(s)=>s.replace(/\u200b/g,'');
  function runs(el,marks={}){if(el.nodeType===3)return[{text:text(el.textContent),...marks}];if(el.nodeType!==1)return[];if(el.tagName==='BR')return[{text:'\n'}];const next={...marks};if(parseInt(el.style.fontSize)>0&&parseInt(el.style.fontSize)<=20&&el.closest('h2'))next.variant='subtitle';if(['STRONG','B'].includes(el.tagName)||parseInt(el.style.fontWeight)>=600)next.strong=true; if(el.tagName==='A'){next.href=el.getAttribute('href');}if(/141.*192.*59|#8dc03b|#8dc03b/i.test(el.style.color))next.tone='accent';else if(/65.*81.*97|#415161/i.test(el.style.color))next.tone='body';else if(el.style.color&&el.style.color!=='rgb(255, 255, 255)')next.tone='ink';return [...el.childNodes].flatMap(n=>runs(n,next));}
  function blocks(el){if(!el)return[];const list=[];for(const node of el.children){const tag=node.tagName.toLowerCase();if(['p','h1','h2','h3','h4'].includes(tag)){list.push({type:tag,runs:runs(node)});}else if(['ul','ol'].includes(tag)){list.push({type:tag,items:[...node.children].filter(x=>x.tagName==='LI').map(x=>runs(x))});}else list.push(...blocks(node));}return list;}
  const elements={};
  for(const el of document.querySelectorAll('.ww_element[data-element-type]')){const id=el.id.replace('element_','');const type=el.dataset.elementType;
   if(type==='text')elements[id]={blocks:blocks(el.querySelector('.text_content'))};
   const img=el.querySelector('img');if(img){let rwd={};try{rwd=JSON.parse(img.getAttribute('data-ww_rwd')||'{}')}catch{};elements[id]={...elements[id],image:{src:rwd['data-lazy-load-src']?.rwdMode_1||img.getAttribute('src'),alt:img.alt,variants:rwd['data-lazy-load-src']||{}}};}
   const svg=el.querySelector('svg');if(svg)elements[id]={...elements[id],image:{src:'data:image/svg+xml,'+encodeURIComponent(svg.outerHTML),alt:img?.alt||'',variants:{}}};
   const iframe=el.querySelector('iframe');if(iframe)elements[id]={...elements[id],video:{src:iframe.src,title:iframe.title}};
  }
  return {elements,links:[...document.querySelectorAll('a[href]')].map(x=>({href:x.getAttribute('href'),text:text(x.textContent).trim()})),formOptions:[...document.querySelectorAll('select option')].map(x=>x.textContent)};
 });
 for(const [id,el]of Object.entries(data.elements))if(el.image){
  for(const [mode,key]of [['desktop','rwdMode_1'],['tablet','rwdMode_2'],['mobile','rwdMode_4']]){const row=measurements[entry.slug]?.[mode]?.rows.find(x=>x.id===`element_${id}_image`);if(row?.src&&!row.src.startsWith('data:'))el.image.variants[key]=row.src;}
  const actual=measurements[entry.slug]?.desktop?.rows.find(x=>x.id===`element_${id}_image`)?.src;if(actual&&!actual.startsWith('data:'))el.image.src=actual;
  const bg=measurements[entry.slug]?.desktop?.rows.find(x=>x.id===`element_${id}_image`)?.css.backgroundImage;const svgBg=bg?.match(/^url\("(data:image\/svg\+xml,[^"]+)"\)$/)?.[1];if(svgBg)el.image.src=svgBg;

el.image.src=await asset(el.image.src);for(const [k,url]of Object.entries(el.image.variants))el.image.variants[k]=await asset(url);}
 captured[entry.slug]={...entry,...data};console.log('Imported',entry.slug);
}
await browser.close();
const get=(slug,id)=>captured[slug].elements[String(id)];
const rich=(slug,id)=>get(slug,id)?.blocks||[];
const image=(slug,id)=>get(slug,id)?.image;
const page=(slug,type,title)=>({slug,path:slug==='home'?'/':'/'+slug,type,seo:{title:captured[slug].title,description:captured[slug].description},heading:title});
const pages={
 '/':{...page('home','home','Bookkeeper in Toowoomba'),intro:rich('home',129),video:get('home',117).video,tagline:rich('home',128),consultation:{label:'Free Consultation',href:'/contact'},contactPrompt:rich('home',127),background:image('home',130),features:[[126,125,124],[123,122,121],[120,119,118]].map(([h,i,p])=>({heading:rich('home',h),image:image('home',i),body:rich('home',p)}))},
 '/why-choose-beyond-books':{...page('why-choose-beyond-books','benefits','Why Choose Beyond Books ?'),features:[[143,142,141],[140,139,138],[137,136,135]].map(([h,i,p])=>({heading:rich('why-choose-beyond-books',h),image:image('why-choose-beyond-books',i),body:rich('why-choose-beyond-books',p)}))},
 '/bookkeeping':{...page('bookkeeping','service','Bookkeeping Services'),sections:[[167,166],[165,164]].map(([i,p])=>({image:image('bookkeeping',i),body:rich('bookkeeping',p)}))},
 '/software-solutions':{...page('software-solutions','software','Software Solutions'),sections:[[177,176],[240,175],[241,174],[239,173]].map(([i,p])=>({image:image('software-solutions',i),video:get('software-solutions',i)?.video,body:rich('software-solutions',p)}))},
 '/streamlining-systems':{...page('streamlining-systems','streamlining','Streamlining Systems'),sections:[[183,182],[181,180]].map(([i,p])=>({image:image('streamlining-systems',i),body:rich('streamlining-systems',p)}))},
 '/about':{...page('about','about','About Beyond Books'),intro:rich('about',145),biography:rich('about',202),image:image('about',201)},
 '/contact':{...page('contact','contact','Contact'),form:{heading:'Email',labels:['Name','Email','Phone',"I’d like more information about",'Tell us more about your specific needs'],options:captured.contact.formOptions,placeholder:'Enter your message here',submitLabel:'Submit',endpoint:'',fallbackEmail:'melissa_plant@bipond.com'},socialImages:[image('contact',148),image('contact',147)],phone:'0429 344 682',postalAddress:'PO Box 434 Highfields QLD 4352',callLabel:'Call',callUrl:captured.contact.links.find(x=>x.text==='Call')?.href||'tel:0429344682'}
};
for(const feature of pages['/why-choose-beyond-books'].features){for(const block of feature.heading){let subtitle=false;for(const run of block.runs||[]){if(run.text.includes('\n'))subtitle=true;else if(subtitle&&run.text.trim())run.variant='subtitle';}}}
const site={name:'Beyond Books Qld',sourceUrl:'https://www.beyondbooks.net.au',phone:'0429 344 682',email:'melissa_plant@bipond.com',logo:image('home',113),nav:[{label:'Home',href:'/'},{label:'Contact',href:'/contact'},{label:'Why Choose Beyond Books?',href:'/why-choose-beyond-books'},{label:'Our Services',children:[{label:'Bookkeeping',href:'/bookkeeping'},{label:'Software Solutions',href:'/software-solutions'},{label:'Streamlining Systems',href:'/streamlining-systems'}]},{label:'About',href:'/about'}],social:{facebook:'https://www.facebook.com/BeyondBooksQld',linkedin:'https://www.linkedin.com/in/beyondbooksqld'},footer:{business:rich('contact',192),address:rich('contact',189),logo:image('contact',193),certifications:[191,190,188,187].map(x=>image('contact',x)),credits:rich('contact',184),socialImages:[image('contact',186),image('contact',185)]},integrations:{vimeo:{status:'preserved',ids:['274042267','425436458','425436495','425436520']},contactForm:{status:'requires-wws-endpoint',fallback:'email-draft',note:'Original form submits through WebWave. Set form.endpoint to the WWS form handler on import. Email shown in source is melissa_plant@bipond.com; confirm before production.'},hangout:{status:'telephone-link',note:'The source Google Hangout-labelled Call button links to the phone number; preserved.'},analytics:{status:'not-copied',note:'Set destination-owned analytics during WWS import.'}}};
for(const item of site.nav){item.children ||= [];item.href ||= '#services';}
for(const page of Object.values(pages))page.seo.canonical='https://www.beyondbooks.net.au'+page.path;
function normalizeLinks(value){if(Array.isArray(value))value.forEach(normalizeLinks);else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(key==='href'&&typeof item==='string')value[key]=item.replace(/^https?:\/\/(www\.)?beyondbooks\.net\.au/,'');else normalizeLinks(item);}}
pages['/'].site=site;normalizeLinks(pages);
fs.writeFileSync(path.join(out,'src/cms/content.json'),JSON.stringify({pageContent:pages},null,2)+'\n');
for(const legacy of ['pages.json','site.json'])fs.rmSync(path.join(out,'src/cms',legacy),{force:true});
const homeHtml=fs.readFileSync(path.join(source,'pages/home/dom.html'),'utf8');
const fontRules=[...homeHtml.matchAll(/@font-face\s*\{([^}]+)\}/g)].filter(m=>m[1].includes('U+0000-00FF'));
const fonts=[];const seen=new Set();for(const m of fontRules){const family=/font-family:\s*['"]?([^;'"}]+)/.exec(m[1])?.[1];const url=/url\((https[^)]+)\)/.exec(m[1])?.[1];if(!url||!family||seen.has(family))continue;seen.add(family);fonts.push({family,src:await asset(url)});}
fs.writeFileSync(path.join(out,'src/cms/fonts.json'),JSON.stringify(fonts,null,2)+'\n');
const retained=new Set();
function retain(value){if(typeof value==='string'&&value.startsWith('/assets/'))retained.add(value);else if(Array.isArray(value))value.forEach(retain);else if(value&&typeof value==='object')Object.values(value).forEach(retain);}
retain(site);retain(pages);retain(fonts);
for(const name of fs.readdirSync(path.join(out,'public/assets'))){if(/^[a-f0-9]{10}(?:-|\.)/.test(name)&&!retained.has('/assets/'+name))fs.unlinkSync(path.join(out,'public/assets',name));}
for(const [url,local]of Object.entries(assetMap))if(!retained.has(local))delete assetMap[url];
fs.writeFileSync(path.join(out,'src/cms/asset-map.json'),JSON.stringify(assetMap,null,2)+'\n');
console.log(`Prepared ${Object.keys(pages).length} pages and ${Object.keys(assetMap).length} local assets in ${out}`);
