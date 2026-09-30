/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const {createPixPayload,crc16} = await import('../src/lib/pix.ts');
 assert.equal(crc16('123456789'),'29B1');
 const payload=createPixPayload(20880,'abc123');
 assert(payload.includes('5406208.80')); assert.equal(payload.slice(-4),crc16(payload.slice(0,-4)));
 assert.throws(()=>createPixPayload(0)); assert.throws(()=>createPixPayload(1,'invalid-id'));
 const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
 const QRCode=require('qrcode');
 const pix=await (await fetch(base+'/api/pix')).json(); assert.equal(pix.payload,createPixPayload()); assert(pix.qr.startsWith('data:image/png;base64,'));
 const {PNG}=require('pngjs');const jsQR=require('jsqr');
 const png=PNG.sync.read(fs.readFileSync('public/assets/anit/pix/anit-chave-pix.png'));
 const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.equal(decoded.data,createPixPayload());
 const unauthorized=await fetch(base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);
 const awaitFixtureQr=await QRCode.toDataURL(payload,{width:512,margin:4});
 const http=require('node:http'),path=require('node:path');const root=path.resolve('public');
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+req.url.split('?')[0]);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const uiBase='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext(); let fail=false, calls=0, sent;
 await context.route(/(cdn\.jsdelivr\.net|auth-client\.js)/,r=>r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}})}})};`}));
 await context.route('**/api/products',r=>r.fulfill({json:[{id:'00000000-0000-4000-8000-000000000001',name:'Bong teste',price:189.90,stock:3}]}));
 await context.route('**/api/orders',r=>{calls++;sent=r.request().postDataJSON();return r.fulfill({status:fail?503:200,json:fail?{error:'Checkout Pix ainda não habilitado no banco da loja.'}:{success:true,orderId:sent.orderId,total:208.8,status:'pending',payload,qr:awaitFixtureQr}});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(uiBase+'/checkout.html');await page.waitForFunction(()=>document.getElementById('message').textContent.includes('vazio'));
 await page.evaluate(()=>localStorage.setItem('ty-cart',JSON.stringify([{id:'00000000-0000-4000-8000-000000000001',name:'Bong teste',price:'R$ 0,01',qty:1}])));
 await page.reload();await page.waitForFunction(()=>!document.getElementById('generate').disabled);
 assert((await page.locator('#estimate').textContent()).includes('208,80'));
 fail=true;await page.locator('#generate').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('habilitado'));assert(await page.locator('#payment').isHidden());
 const firstId=sent.orderId;fail=false;await page.locator('#generate').click();await page.locator('#payment').waitFor({state:'visible'});
 assert.equal(sent.orderId,firstId);assert.equal(sent.total,undefined);assert.equal(sent.items[0].price,undefined);assert.equal(await page.locator('#payload').inputValue(),payload);
 assert(await page.evaluate(()=>!!localStorage.getItem('ty-cart')));
 await page.reload();await page.locator('#payment').waitFor({state:'visible'});assert.equal(calls,2);
 fs.mkdirSync('screenshots/anit',{recursive:true});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await page.screenshot({path:'screenshots/anit/checkout-pix.png',fullPage:true});}
 assert.deepEqual(errors,[]); console.log('Pix: CRC/valor, QR endpoint, autenticação, carrinho vazio, preço do catálogo, erro/retry, idempotência, recuperação, carrinho preservado e 4 larguras OK. Sem pagamentos ou gravações reais.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
