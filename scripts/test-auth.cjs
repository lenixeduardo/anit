/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
const { build } = require('esbuild');
const { NextRequest } = require('next/server');

// Inject only the external Auth service; exercise the actual Next.js responses.
async function load(entry) {
  const compiled = (await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['next/server'], plugins: [{name: 'auth-fixture', setup(build) {
      build.onResolve({filter: /^@supabase\/ssr$/}, () => ({path: 'fixture', namespace: 'auth'}));
      build.onLoad({filter: /.*/, namespace: 'auth'}, () => ({contents: `exports.createServerClient = (url,key,options) => {
        options.cookies.setAll([{name:'refreshed',value:'yes',options:{path:'/'}}]);
        return {auth:{getUser: async()=>global.__authFixture,exchangeCodeForSession:async()=>({error:global.__callbackError})},
          from:()=>({select:()=>({eq:()=>({single:async()=>global.__roleFixture})})})};
      };`, loader: 'js'}));
    }}] })).outputFiles[0].text;
  const mod = new Module(__filename); mod.filename = __filename; mod.paths = module.paths; mod._compile(compiled, __filename); return mod.exports;
}

(async () => {
  const {proxy} = await load('src/proxy.ts');
  const request = path => new NextRequest('http://localhost:3000'+path);
  global.__authFixture = {data:{user:null},error:null};
  for (const path of ['/perfil.html','/checkout.html','/pedidos.html','/admin.html','/admin-pedidos.html','/compra-confirmada.html']) {
    const response=await proxy(request(path+'?id=123'));
    assert.equal(response.status,307); assert.equal(new URL(response.headers.get('location')).searchParams.get('next'),path+'?id=123');
    assert.equal(response.headers.get('cache-control'),'private, no-store'); assert.equal(response.cookies.get('refreshed').value,'yes');
  }
  global.__authFixture = {data:{user:{id:'customer',is_anonymous:false}},error:null};
  assert.equal((await proxy(request('/perfil.html'))).status,200);
  global.__roleFixture={data:{role:'user'},error:null};
  assert.equal((await proxy(request('/admin.html'))).status,403);
  global.__roleFixture={data:null,error:{message:'unavailable'}};
  assert.equal((await proxy(request('/admin.html'))).status,403);
  global.__roleFixture={data:{role:'admin'},error:null};
  assert.equal((await proxy(request('/admin-pedidos.html'))).status,200);
  global.__authFixture={data:{user:{id:'anonymous',is_anonymous:true}},error:null};
  assert.equal((await proxy(request('/perfil.html'))).status,307);
  const {safeAuthRedirect} = await load('src/lib/auth-redirect.ts');
  for (const value of ['https://evil.example','//evil.example','/\\evil.example','/api/orders','/%2f%2fevil.example']) assert.equal(safeAuthRedirect(value),'/perfil.html');
  const callback=await load('src/app/auth/callback/route.ts');
  global.__callbackError=null;
  let response=await callback.GET(request('/auth/callback?code=fixture&next=/checkout.html'));
  assert.equal(new URL(response.headers.get('location')).pathname,'/checkout.html'); assert.equal(response.cookies.get('refreshed').value,'yes');
  global.__callbackError={message:'expired'};
  response=await callback.GET(request('/auth/callback?code=expired&next=//evil.example'));
  assert.equal(new URL(response.headers.get('location')).pathname,'/login.html');
  // Live server checks: forged local state cannot retrieve a protected page.
  const base=process.env.TEST_BASE_URL || 'http://localhost:3000';
  for (const path of ['/perfil.html','/checkout.html','/pedidos.html','/admin.html','/admin-pedidos.html','/PERFIL.html','/%70erfil.html','/ADMIN.html']) {
    const response=await fetch(base+path,{redirect:'manual',headers:{Cookie:'ty-user=admin; sb-access-token=forged'}});
    assert.equal(response.status,307); assert.match(response.headers.get('location'),/login\.html/);
  }
  assert.equal((await fetch(base+'/store.html')).status,200);
  console.log('Auth OK: protected pages, forged cookies, customer/admin/anonymous roles, refreshed cookies, callback and safe redirects. Remote Auth mocked; no accounts created.');
})().catch(error=>{console.error(error);process.exitCode=1});
