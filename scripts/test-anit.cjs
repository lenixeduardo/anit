/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS browser test runner. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const output = path.join(root, 'screenshots/anit');
fs.mkdirSync(output, { recursive: true });
// Isolated fixtures: no live accounts, payments or database writes.
const fixtures = [
 {id:'test-bong',name:'Bong Straight Crystal',description:'Peça de teste.',price:189.9,stock:2,category:'bong',image_url:'assets/produto-bong-cylinder.jpeg'},
 {id:'test-torch',name:'Maçarico Titanium Pro',description:'Peça de teste.',price:89.9,stock:5,category:'macarico',image_url:'assets/produto-torch-silver.png'},
 {id:'test-bowl',name:'Bowl Cobra Azul',description:'Peça de teste.',price:49.9,stock:0,category:'bowl',image_url:'assets/produto-bowl-blue.png'}
];
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server = http.createServer((req,res) => {
 const route = req.url.split('?')[0];
 if(route === '/api/products'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtures));return;}
 const file = path.resolve(publicDir, '.' + decodeURIComponent(route === '/' ? '/store.html' : route));
 if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
const mock = `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'test-user',email:'teste@example.invalid',user_metadata:{full_name:'Conta de teste'}}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),signInWithOAuth:async()=>({})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'customer'}}),order:async()=>({data:[]})})})})})};`;
(async () => {
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext();
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(url.endsWith('/auth-client.js'))return route.fulfill({contentType:'text/javascript',body:mock});
  if(url.startsWith(base))return route.continue();
  if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:mock});
  return route.abort();
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const checks=[];
 async function loaded(){await page.waitForLoadState('domcontentloaded');await page.evaluate(async()=>{for(const im of document.images)im.loading='eager';await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));});}
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:960});
  for(const file of ['store.html','colecoes.html','produtos.html','produto.html?id=test-bong','carrinho.html','login.html','perfil.html','checkout.html']){
   await page.goto(base+'/'+file);await loaded();
   if(['store.html','produtos.html'].includes(file))await page.locator('.product-card').first().waitFor();
   if(file.startsWith('produto.'))await page.locator('.detail-copy').waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,20)));
   assert.equal(overflow,false,`${file} overflows at ${width}`);
   const broken=await page.evaluate(()=>[...document.images].filter(im=>im.naturalWidth===0).map(im=>im.src));
   assert.deepEqual(broken,[],`${file} broken images at ${width}`);
   checks.push({file,width,overflow,broken});
   if(width===390||width===1440)await page.screenshot({path:path.join(output,`${file.split('.')[0]}-${width}.png`),fullPage:true});
  }
 }
 await page.goto(base+'/produtos.html');await page.locator('.product-card').first().waitFor();
 assert.equal(await page.locator('.product-card').count(),3);
 await page.getByRole('button',{name:'Maçaricos',exact:true}).click();
 assert.equal(await page.locator('.product-card').count(),1);
 await page.reload();await page.locator('.product-card').first().waitFor();assert.equal(await page.locator('.product-card').count(),1);
 await page.goto(base+'/produtos.html?q=MACARICO');await page.locator('.product-card').first().waitFor();assert.equal(await page.locator('.product-card').count(),1);
 await page.goto(base+'/produtos.html');await page.locator('.product-card').first().waitFor();
 await page.selectOption('#sort','price-asc');assert.match(await page.locator('.product-card').first().innerText(),/Bowl Cobra Azul/);
 assert.equal(await page.locator('[data-add="test-bowl"]').isDisabled(),true);
 await page.locator('[data-favorite="test-bong"]').click();
 await page.goto(base+'/produtos.html?favoritos=1');await page.locator('.product-card').first().waitFor();assert.equal(await page.locator('.product-card').count(),1);
 await page.goto(base+'/produto.html?id=test-bong');await page.locator('.detail-copy').waitFor();
 await page.locator('[data-quantity="1"]').click();assert.equal(await page.locator('#quantity').inputValue(),'2');
 await page.locator('.detail-add').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ty-cart'))[0].qty),2);
 await page.locator('.detail-add').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ty-cart'))[0].qty),2);
 await page.goto(base+'/carrinho.html');await loaded();assert.equal(await page.locator('.cart-item').count(),1);
 await page.locator('.qty-btn').first().click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ty-cart'))[0].qty),1);
 await page.reload();assert.equal(await page.locator('.cart-item').count(),1);
 await page.locator('.item-remove').click();assert.equal(await page.locator('.cart-item').count(),0);
 await page.goto(base+'/login.html');await page.locator('#tab-register').click();assert.equal(await page.locator('#fname').isVisible(),true);
 await page.locator('#tab-login').click();assert.equal(await page.locator('#fname').isVisible(),false);
 await page.goto(base+'/produto.html?id=missing');await page.getByRole('heading',{name:'Produto não encontrado'}).waitFor();
 await page.route('**/api/products',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto(base+'/produtos.html');await page.getByRole('button',{name:'Tentar novamente'}).waitFor();
 await page.unroute('**/api/products');await page.getByRole('button',{name:'Tentar novamente'}).click();await page.locator('.product-card').first().waitFor();
 assert.deepEqual(errors,[],'page errors');
 const report={screens:checks,flows:['category and reload','accent-insensitive search','sorting','out of stock','favorites persistence','detail quantity','stock limit','legacy cart compatibility','cart persistence and removal','login tabs','missing product','catalog retry'],errors,externalRequests:'blocked; Supabase mocked; no live writes'};
 fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));
 console.log(`PASS: ${checks.length} responsive screens, ${report.flows.length} interaction flows, no page errors.`);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exit(1);});
