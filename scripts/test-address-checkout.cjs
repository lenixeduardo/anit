/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const address = { recipient: 'Cliente Teste', postal_code: '01001000', street: 'Rua Teste', number: '10', complement: '', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' };
class Node {
  constructor() { this.disabled = false; this.hidden = true; this.value = ''; this.children = []; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  scrollIntoView() {}
  reportValidity() { return Object.entries(this.elements).every(([key, node]) => key === 'complement' || node.value.trim()); }
}
const storage = initial => {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
async function fixture(shippingEnabled = false, priorStorage) {
  const nodes = new Map(), node = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const form = node('form'), fieldset = node('fieldset');
  form.elements = Object.fromEntries(Object.keys(address).map(key => [key, new Node()]));
  node('endereco').querySelector = selector => selector === 'form' ? form : selector === 'fieldset' ? fieldset : node('address-message');
  form.querySelector = () => node('save');
  let savedAddress = null, posts = 0, recovery = 0, serverReject = false, writes = 0, sent;
  const session = { user: { id: 'fixture-user' }, access_token: 'fixture-token' };
  const client = { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange() {} }, from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { shipping_address: savedAddress }, error: null }) }) }),
    update: data => ({ eq: () => ({ select: () => ({ single: async () => { writes++; savedAddress = data.shipping_address; return { data, error: null }; } }) }) })
  }) };
  const listeners = {};
  const context = { console, crypto: { randomUUID }, setTimeout() {}, Date, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    document: { getElementById: node, createElement: () => new Node() },
    FormData: class { constructor(form) { this.form = form; } *[Symbol.iterator]() { for (const [key, input] of Object.entries(this.form.elements)) yield [key, input.value]; } },
    navigator: { clipboard: { writeText: async () => {} } }, location: {},
    localStorage: storage({ 'ty-cart': JSON.stringify([{ id: 'product', qty: 1 }]) }),
    sessionStorage: priorStorage || storage({}), supabase: { createClient: () => client },
    addEventListener: (name, callback) => { listeners[name] = callback; }, dispatchEvent: event => listeners[event.type]?.(event),
    fetch: async (url, options) => {
      const response = data => ({ ok: true, status: 200, json: async () => data });
      if (url === '/api/config') return response({ shippingEnabled });
      if (url === '/api/products') return response([{ id: 'product', name: 'Produto Teste', price: 100, stock: 4 }]);
      if (url === '/api/shipping') return response({ expiresAt: new Date(Date.now() + 900000).toISOString(), options: [{ quoteId: 'pac', name: 'PAC', price: 18.9, days: 5 }, { quoteId: 'sedex', name: 'SEDEX', price: 29.9, days: 2 }] });
      const payment = { success: true, orderId: sent?.orderId || 'saved-order', total: 118.9, shippingAddress: savedAddress || address, payload: 'fixture-pix', qr: 'fixture-qr' };
      if (url.startsWith('/api/orders?')) { recovery++; return response(payment); }
      assert.equal(url, '/api/orders'); posts++; sent = JSON.parse(options.body);
      return serverReject ? { ok: false, status: 422, json: async () => ({ code: 'ADDRESS_REQUIRED', error: 'Cadastre um endereço.' }) } : response(payment);
    }
  };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/endereco.js', 'utf8'), context);
  await vm.runInContext(fs.readFileSync('public/checkout.js', 'utf8'), context);
  return { context, node, form, fill: () => { for (const [key, value] of Object.entries(address)) form.elements[key].value = value; },
    save: () => form.listeners.submit({ preventDefault() {} }), get posts() { return posts; }, get recovery() { return recovery; }, get writes() { return writes; }, get sent() { return sent; }, reject: value => { serverReject = value; } };
}
(async () => {
  const f = await fixture();
  assert.equal(f.node('generate').disabled, true);
  await f.node('generate').onclick(); assert.equal(f.posts, 0);
  await f.save(); assert.equal(f.writes, 0);
  f.fill(); await f.save(); assert.equal(f.node('generate').disabled, false);
  f.form.listeners.input(); assert.equal(f.node('generate').disabled, true);
  await f.save(); f.reject(true); await f.node('generate').onclick();
  assert.equal(f.node('generate').disabled, true); assert.equal(f.node('payment').hidden, true);
  await f.save(); f.reject(false); await f.node('generate').onclick();
  assert.equal(f.node('payment').hidden, false); assert.equal(f.sent.shipping_address, undefined); assert.equal(f.sent.total, undefined);
  const stored = f.context.sessionStorage.getItem('anit-pix-order'); assert(!stored.includes('Rua Teste')); assert(!stored.includes('fixture-pix'));
  const resumed = await fixture(false, f.context.sessionStorage); assert.equal(resumed.posts, 0); assert.equal(resumed.recovery, 1); assert.equal(resumed.node('payment').hidden, false);
  const s = await fixture(true); s.fill(); await s.save();
  assert.equal(s.node('generate').disabled, true);
  await s.node('calculate').onclick(); assert.equal(s.node('shipping-options').children.length, 2);
  s.node('shipping-options').children[1].children[0].onchange(); assert.equal(s.node('generate').disabled, false);
  assert(s.node('estimate').textContent.includes('129,90'));
  s.form.listeners.input(); assert.equal(s.node('generate').disabled, true); assert.equal(s.node('shipping-options').children.length, 0);
  await s.save(); await s.node('calculate').onclick(); s.node('shipping-options').children[0].children[0].onchange();
  await s.node('generate').onclick(); assert.equal(s.sent.shippingQuoteId, 'pac');
  console.log('PASS endereço/checkout: cadastro obrigatório, edição invalida, servidor 422, recuperação verificada, dados pessoais fora do cache, PAC/SEDEX vinculados ao endereço. Serviços simulados; nenhuma compra real.');
})().catch(error => { console.error(error); process.exitCode = 1; });
