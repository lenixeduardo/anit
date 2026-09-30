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
 const QRCode=require('qrcode');
 const awaitFixtureQr=await QRCode.toDataURL(payload,{width:512,margin:4});
 const http=require('node:http'),path=require('node:path');const root=path.resolve('public');
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+req.url.split('?')[0]);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const uiBase='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext(); let fail=false, calls=0, sent;
 await context.route(/(cdn\.jsdelivr\.net|auth-client\.js)/,r=>r.fulfill({contentType:'text/javascript',body:"let fixtureAddress={\"recipient\":\"Cliente Teste\",\"postal_code\":\"01001000\",\"street\":\"Rua Teste\",\"number\":\"10\",\"complement\":\"\",\"neighborhood\":\"Centro\",\"city\":\"São Paulo\",\"state\":\"SP\"};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'},access_token:'fixture-token'}}}),onAuthStateChange:()=>{}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{shipping_address:fixtureAddress},error:null})})}),update:data=>({eq:()=>({select:()=>({single:async()=>{fixtureAddress=data.shipping_address;return {data,error:null};}})})})})})};"}));
 await context.route('**/api/config',r=>r.fulfill({json:{shippingEnabled:true}}));
 await context.route('**/api/products',r=>r.fulfill({json:[{id:'00000000-0000-4000-8000-000000000001',name:'Bong teste',price:189.90,stock:3}]}));
 await context.route('**/api/orders**',r=>{if(r.request().method()==='GET')return r.fulfill({json:{orderId:sent.orderId,total:208.8,shippingAddress:{"recipient":"Cliente Teste","postal_code":"01001000","street":"Rua Teste","number":"10","complement":"","neighborhood":"Centro","city":"São Paulo","state":"SP"},payload,qr:awaitFixtureQr}});calls++;sent=r.request().postDataJSON();return r.fulfill({status:fail?503:200,json:fail?{error:'Checkout Pix ainda não habilitado no banco da loja.'}:{success:true,orderId:sent.orderId,total:208.8,status:'pending',shippingAddress:{"recipient":"Cliente Teste","postal_code":"01001000","street":"Rua Teste","number":"10","complement":"","neighborhood":"Centro","city":"São Paulo","state":"SP"},payload,qr:awaitFixtureQr}});});
 await context.route('**/api/shipping',r=>r.fulfill({json:{expiresAt:new Date(Date.now()+900000).toISOString(),options:[{quoteId:'40000000-0000-4000-8000-000000000001',name:'Correios · PAC',price:18.90,days:5},{quoteId:'40000000-0000-4000-8000-000000000002',name:'Correios · SEDEX',price:29.90,days:2}]}}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(uiBase+'/checkout.html');await page.waitForFunction(()=>document.getElementById('message').textContent.includes('vazio'));
 await page.evaluate(()=>localStorage.setItem('ty-cart',JSON.stringify([{id:'00000000-0000-4000-8000-000000000001',name:'Bong teste',price:'R$ 0,01',qty:1}])));
 await page.reload();await page.waitForFunction(()=>!document.getElementById('calculate').disabled);
 assert(await page.locator('#generate').isDisabled());
 await page.locator('#calculate').click();await page.locator('input[name="shipping"]').first().waitFor();
 assert.equal(await page.locator('input[name="shipping"]').count(),2);
 await page.locator('input[name="shipping"]').nth(1).check();assert((await page.locator('#estimate').textContent()).includes('219,80'));
 await page.locator('#address-postal_code').fill('01310-100');assert(await page.locator('#generate').isDisabled());assert.equal(await page.locator('input[name="shipping"]').count(),0);
 await page.locator('#address-form button').click();await page.waitForFunction(()=>!document.getElementById('calculate').disabled);await page.locator('#calculate').click();await page.locator('input[name="shipping"]').first().check();
 assert((await page.locator('#estimate').textContent()).includes('208,80'));
 fail=true;await page.locator('#generate').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('habilitado'));assert(await page.locator('#payment').isHidden());
 const firstId=sent.orderId;fail=false;await page.locator('#generate').click();await page.locator('#payment').waitFor({state:'visible'});
 assert.equal(sent.shippingQuoteId,'40000000-0000-4000-8000-000000000001');assert.equal(sent.orderId,firstId);assert.equal(sent.total,undefined);assert.equal(sent.items[0].price,undefined);assert.equal(await page.locator('#payload').inputValue(),payload);
 assert(await page.evaluate(()=>!!localStorage.getItem('ty-cart')));
 await page.reload();await page.locator('#payment').waitFor({state:'visible'});assert.equal(calls,2);
 fs.mkdirSync('screenshots/anit',{recursive:true});
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await page.screenshot({path:'screenshots/anit/checkout-pix.png',fullPage:true});}
 assert.deepEqual(errors,[]); console.log('Frete: duas modalidades, CEP, mudança de seleção/total, invalidação por CEP e vínculo ao pedido. Pix: CRC/valor, QR endpoint, autenticação, carrinho vazio, preço do catálogo, erro/retry, idempotência, recuperação, carrinho preservado e 4 larguras OK. Sem pagamentos ou gravações reais.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
