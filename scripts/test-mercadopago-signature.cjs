/* Teste determinístico local; não requer credenciais de pagamento. */
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const file = 'src/lib/mercadopago-webhook.ts';
const source = ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS,target: ts.ScriptTarget.ES2022}
}).outputText;
const compiled = new Module(file, module);
compiled.filename = require('node:path').resolve(file);
compiled.paths = module.paths;
compiled._compile(source,compiled.filename);
const {verifyMercadoPagoSignature:verify} = compiled.exports;
const secret='local-test-only';
const requestId='req-abc';
const dataId='12345';
const now=Date.now();
for (const tsValue of [String(Math.round(now/1000)),String(now)]) {
  const payload = `id:${dataId};request-id:${requestId};ts:${tsValue};`;
  const signature='ts='+tsValue+',v1='+createHmac('sha256',secret).update(payload).digest('hex');
  assert.equal(verify({dataId,requestId,signature,secret,now}),true);
  assert.equal(verify({dataId,requestId:'wrong',signature,secret,now}),false);
  assert.equal(verify({dataId,requestId,signature,secret:'wrong',now}),false);
  assert.equal(verify({dataId,requestId,signature,secret,now:now+600000}),false);
}
console.log('Assinatura PIX: HMAC válido, adulteração e expiração verificados.');
