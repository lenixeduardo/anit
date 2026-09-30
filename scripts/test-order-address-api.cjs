/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
const { build } = require('esbuild');
(async () => {
  const compiled = (await build({ entryPoints: ['src/app/api/orders/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['next/server', 'qrcode'],
    define: { 'process.env.SHIPPING_ENABLED': '"false"' }, plugins: [{ name: 'database-fixture', setup(build) {
      build.onResolve({filter: /^@\/lib\/supabase$/}, () => ({path: 'fixture', namespace: 'database'}));
      build.onLoad({filter: /.*/, namespace: 'database'}, () => ({contents: `
        exports.supabase = {auth:{getUser:async()=>({data:{user:{id:'fixture-user'}},error:null})}};
        exports.createAuthenticatedClient = () => ({rpc:async(name,args)=>{global.__rpcArgs=args;return global.__rpcResult;},
          auth:{getUser:exports.supabase.auth.getUser},from:(table)=>{
            const chain={select:()=>chain,eq:()=>chain,order:()=>chain,range:()=>chain,
              single:async()=>({data:{role:'user'}}),then:resolve=>resolve({data:[{id:'30000000-0000-4000-8000-000000000001',status:'pending',total:118.9,shipping_address:null}],error:null})};return chain;
          }});`, loader: 'js'}));
    }}] })).outputFiles[0].text;
  const module = new Module(__filename); module.filename = __filename; module.paths = require.main.paths; module._compile(compiled, __filename);
  const { POST, GET } = module.exports;
  const body = { orderId:'30000000-0000-4000-8000-000000000001',items:[{id:'20000000-0000-4000-8000-000000000001',qty:1}] };
  const request = authenticated => new Request('http://fixture.invalid/api/orders', {method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer fixture-token'}:{})},body:JSON.stringify(body)});
  assert.equal((await POST(request(false))).status,401);
  global.__rpcResult = {data:null,error:{code:'P0001',message:'ADDRESS_REQUIRED'}};
  const blocked = await POST(request(true)); assert.equal(blocked.status,422); assert.equal((await blocked.json()).code,'ADDRESS_REQUIRED');
  assert.equal(global.__rpcArgs.p_shipping_quote,undefined);
  const legacy = await GET(new Request('http://fixture.invalid/api/orders?id='+body.orderId+'&pix=1',{headers:{Authorization:'Bearer fixture-token'}}));
  assert.equal(legacy.status,422); assert.equal((await legacy.json()).code,'ADDRESS_REQUIRED');
  console.log('PASS API: autenticação, erro 422 para endereço ausente e bloqueio de reemissão de Pix em pedido antigo sem endereço. Banco simulado.');
})().catch(error=>{console.error(error);process.exitCode=1;});
