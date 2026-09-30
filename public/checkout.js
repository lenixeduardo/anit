(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = text => { $('message').textContent = text; };
  function showPayment(data) {
    $('review').hidden = true; $('payment').hidden = false;
    $('amount').textContent = money(data.total); $('order').textContent = 'Pedido ' + data.orderId;
    $('qr').src = data.qr; $('payload').value = data.payload; $('download').href = data.qr;
    message('Pix gerado. O pagamento ainda não foi confirmado.');
  }
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('payload').value); message('Código Pix copiado.'); }
    catch { $('payload').select(); message('Selecione e copie o código no campo acima.'); }
  };
  try {
    let cart = JSON.parse(localStorage.getItem('ty-cart') || '[]');
    if (!Array.isArray(cart) || !cart.length) { message('Seu carrinho está vazio. Escolha os produtos na loja.'); return; }
    const fingerprint = JSON.stringify({ cart, coupon: sessionStorage.getItem('anit-checkout-coupon') || '' });
    const saved = JSON.parse(sessionStorage.getItem('anit-pix-order') || 'null');
    if (saved?.fingerprint === fingerprint && saved.data?.payload) { showPayment(saved.data); return; }
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Não foi possível consultar os produtos. Recarregue a página.');
    const products = await response.json(); let subtotal = 0;
    cart = cart.map(item => {
      const product = products.find(p => item.id ? p.id === item.id : p.name === item.name);
      if (!product || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 || item.qty > product.stock) throw new Error('Produto indisponível ou estoque insuficiente. Revise o carrinho.');
      subtotal += Number(product.price) * item.qty;
      const row = document.createElement('p'); const name = document.createElement('span'); const price = document.createElement('strong');
      name.textContent = item.qty + ' × ' + product.name; price.textContent = money(product.price * item.qty); row.append(name, price); $('items').append(row);
      return { id: product.id, qty: item.qty };
    });
    const coupon = sessionStorage.getItem('anit-checkout-coupon') || '';
    const discount = coupon === 'PRINCESS10' ? Math.round(subtotal * 10) / 100 : 0;
    $('estimate').textContent = 'Total estimado: ' + money(subtotal - discount + (subtotal >= 200 ? 0 : 18.90));
    if (!window.supabase) throw new Error('Não foi possível carregar o login. Recarregue a página.');
    const client = window.supabase.createClient(window.__SUPABASE_URL, window.__SUPABASE_ANON_KEY);
    const session = (await client.auth.getSession()).data.session;
    const attempt = JSON.parse(sessionStorage.getItem('anit-pix-attempt') || 'null');
    const orderId = attempt?.fingerprint === fingerprint ? attempt.orderId : crypto.randomUUID();
    sessionStorage.setItem('anit-pix-attempt', JSON.stringify({ fingerprint, orderId }));
    $('generate').disabled = false; $('generate').textContent = session ? 'Gerar Pix do pedido' : 'Entrar para finalizar';
    message(session ? 'Confira os itens antes de gerar o Pix.' : 'Faça login e retorne ao carrinho para finalizar.');
    $('generate').onclick = async () => {
      if (!session) { location.href = 'login.html'; return; }
      $('generate').disabled = true; message('Criando pedido…');
      try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ orderId, items: cart, coupon }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível gerar o Pix.');
        sessionStorage.setItem('anit-pix-order', JSON.stringify({ fingerprint, data })); showPayment(data);
      } catch (error) { message(error.message); $('generate').disabled = false; }
    };
  } catch (error) { message(error.message || 'Não foi possível carregar o pedido.'); }
})();
