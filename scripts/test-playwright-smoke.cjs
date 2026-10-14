/* Real Chromium smoke test: layout, images, forms, and error states without live payments. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({headless:true});
 const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
 const pages = ['store.html','produtos.html','produto.html','carrinho.html','login.html','faq.html'];
 let failures=[];
 fs.mkdirSync('test-results/anit', {recursive:true});
 try {
  for (const width of [320,390,768,1440]) {
   const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
   for (const path of pages) {
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(origin+'/'+path,{waitUntil:'domcontentloaded'});
    assert(response && response.status()<400, path+' HTTP failed');
    await page.waitForTimeout(350);
    const metrics=await page.evaluate(()=>({
      documentWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth,
      invalidImages:[...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.getAttribute('src') && !i.getAttribute('src').startsWith('data:')).map(i=>i.getAttribute('src')),
      fields:[...document.querySelectorAll('input,textarea,select')].filter(x=>!x.disabled).length
    }));
    if(metrics.documentWidth > metrics.viewportWidth+2) failures.push(path+' @'+width+': horizontal overflow '+metrics.documentWidth);
    if(metrics.invalidImages.length) failures.push(path+' @'+width+': broken images '+metrics.invalidImages.slice(0,5).join(','));
    if(errors.length) failures.push(path+' @'+width+': JavaScript '+errors.slice(0,3).join('; '));
    if(width===390 || width===1440) await page.screenshot({path:'test-results/anit/'+path+'-'+width+'.png',fullPage:true});
    await page.close();
   }
   await context.close();
  }
  if(failures.length){console.error(failures.join('\n'));process.exitCode=1;} else console.log('Chromium: 6 páginas x 4 larguras, imagens, erros JS e screenshots OK.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
