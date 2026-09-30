/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('public'); let admin=false, signedIn=true, failed=false;
const orders=[{id:'30000000-0000-4000-8000-000000000001',status:'pending',total:208.8,created_at:'2026-09-29T12:00:00Z',profiles:{name:'Cliente <script>alert(1)</script>',email:'cliente@example.invalid'},order_items:[{quantity:1,price:189.9,products:{name:'Produto teste'}}],order_status_history:[]},{id:'30000000-0000-4000-8000-000000000002',status:'paid',total:100,created_at:'2026-09-28T12:00:00Z',profiles:{name:'Cliente',email:'cliente@example.invalid'},order_items:[],order_status_history:[]}];
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const {createPixPayload}=await import('../src/lib/pix.ts');const payload=createPixPayload(20880,'test');const qr=await require('qrcode').toDataURL(payload);
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext();
 await context.route('**/*',async r=>{const url=r.request().url();
 if(url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js') || url.endsWith('/auth-client.js'))return r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:${signedIn?"{access_token:'test-token',user:{id:'test-user'}}":'null'}}}),onAuthStateChange:()=>({})}})};`});
 if(url.startsWith(base+'/api/orders')){
  if(failed)return r.fulfill({status:503,json:{error:'Banco indisponível'}});
  if(url.includes('scope=admin')&&!admin)return r.fulfill({status:403,json:{error:'Acesso restrito ao administrador'}});
  if(r.request().method()==='PATCH'){const body=r.request().postDataJSON();if(body.status==='paid')assert.equal(body.paymentVerified,true);const o=orders.find(x=>x.id===body.id);o.status=body.status;if(body.tracking)o.tracking_code=body.tracking;o.order_status_history.push({status:body.status,created_at:new Date().toISOString()});return r.fulfill({json:{success:true}});}
  if(url.includes('pix=1'))return r.fulfill({json:{payload,qr,total:208.8}});
  return r.fulfill({json:orders});
 }
 if(url.startsWith(base))return r.continue();return r.abort();});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 fs.mkdirSync('screenshots/anit',{recursive:true});
 for(const adminMode of [false,true]){
  admin=adminMode;await page.goto(base+'/'+(admin?'admin-pedidos':'pedidos')+'.html?id='+orders[0].id);await page.getByText('Total do pedido: R$ 208,80',{exact:true}).waitFor();
  assert.equal(await page.locator('#detail script').count(),0);
  if(!admin){assert.equal(await page.getByRole('button',{name:'Confirmar recebimento do Pix'}).count(),0);await page.getByRole('button',{name:'Ver Pix do pedido'}).click();await page.locator('#detail textarea').waitFor();assert.equal(await page.locator('#detail textarea').inputValue(),payload);}
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390||width===1440)await page.screenshot({path:'screenshots/anit/'+(admin?'admin-pedidos':'pedidos')+'-'+width+'.png',fullPage:true});}
  await page.locator('#filter').selectOption('paid');assert.equal(await page.locator('#list article').count(),1);await page.locator('#filter').selectOption('');await page.locator('#search').fill('Produto teste');assert.equal(await page.locator('#list article').count(),1);await page.locator('#search').fill('');
 }
 await page.getByRole('button',{name:'Confirmar recebimento do Pix'}).click();await page.getByRole('button',{name:'Registrar envio'}).waitFor();
 await page.getByRole('button',{name:'Registrar envio'}).click();assert((await page.locator('#message').textContent()).includes('Informe o código'));
 await page.getByLabel('Código de rastreio').fill('TEST123');await page.getByRole('button',{name:'Registrar envio'}).click();await page.getByRole('button',{name:'Marcar como entregue'}).waitFor();
 await page.getByRole('button',{name:'Marcar como entregue'}).click();await page.waitForFunction(()=>document.querySelector('#detail .pill').textContent==='Entregue');assert((await page.locator('#detail').textContent()).includes('TEST123'));
 admin=false;await page.reload();await page.getByText('Acesso restrito ao administrador',{exact:true}).waitFor();assert.equal(await page.locator('#list article').count(),0);
 failed=true;await page.goto(base+'/pedidos.html');await page.getByText('Banco indisponível',{exact:true}).waitFor();failed=false;await page.getByRole('button',{name:'Atualizar',exact:true}).click();await page.locator('#list article').first().waitFor();
 signedIn=false;await page.goto(base+'/pedidos.html');await page.waitForURL('**/login.html');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});const logo=page.locator('.login-logo');assert(await logo.isVisible());assert(await logo.evaluate(el=>el.complete&&el.naturalWidth>0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await page.screenshot({path:'screenshots/anit/login-logo-390.png',fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS painéis: Pix, filtro/busca, dados seguros, confirmação, envio/rastreio, entrega, acesso negado, erro/retry, login, logo e responsividade. Fixtures isoladas.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
