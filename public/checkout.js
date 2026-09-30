(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = text => { $('message').textContent = text; };
  let busy = false, session, shippingEnabled = false, selectedShipping = null, shippingExpires = 0, subtotal = 0, discount = 0;
  function hasAddress() { return session && window.anitValidShippingAddress?.(window.anitShippingAddress); }
  function canGenerate() { return hasAddress() && (!shippingEnabled || (selectedShipping && shippingExpires > Date.now())); }
  function estimate() {
    const shipping = shippingEnabled ? selectedShipping?.price : subtotal >= 200 ? 0 : 18.90;
    $('estimate').textContent = shipping === undefined ? 'Subtotal com desconto: ' + money(subtotal - discount) + ' · Selecione o frete.' : 'Total estimado: ' + money(subtotal - discount + shipping);
  }
  function resetShipping() {
    selectedShipping = null; shippingExpires = 0;
    $('shipping-options').replaceChildren();
    $('postal-code').value = window.anitShippingAddress?.postal_code || '';
    $('calculate').disabled = !hasAddress();
    $('shipping-message').textContent = hasAddress() ? 'Calcule o frete para o endereço salvo.' : 'Salve seu endereço para consultar preço e prazo.';
    estimate(); refreshButton();
  }
  function refreshButton() {
    $('generate').disabled = busy || !canGenerate();
    $('generate').textContent = 'Gerar Pix do pedido';
  }
  function showPayment(data) {
    if (!window.anitValidShippingAddress?.(data.shippingAddress)) throw new Error('O pedido não possui um endereço de entrega válido.');
    $('review').hidden = true; $('payment').hidden = false;
    $('amount').textContent = money(data.total); $('order').textContent = 'Pedido ' + data.orderId;
    const address = data.shippingAddress;
    $('delivery-address').textContent = 'Entrega para ' + address.recipient + ': ' + address.street + ', ' + address.number + (address.complement ? ' · ' + address.complement : '') + ' · ' + address.neighborhood + ' · ' + address.city + '/' + address.state + ' · CEP ' + address.postal_code;
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
    const addressState = await window.anitAddressReady;
    const client = addressState?.client;
    session = (await client?.auth.getSession())?.data.session;
    if (!session) { message('Faça login para finalizar.'); location.href = 'login.html?next=/checkout.html'; return; }
    client.auth.onAuthStateChange((event, current) => { session = current; refreshButton(); if (!current) location.href = 'login.html?next=/checkout.html'; });
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('Não foi possível carregar o checkout. Recarregue a página.');
    shippingEnabled = (await configResponse.json()).shippingEnabled === true;
    $('shipping-fieldset').hidden = !shippingEnabled;
    // User identity and version prevent old or other-account caches from being reused.
    const fingerprint = JSON.stringify({ version: 2, userId: session.user.id, shippingEnabled, cart, coupon: sessionStorage.getItem('anit-checkout-coupon') || '' });
    const saved = JSON.parse(sessionStorage.getItem('anit-pix-order') || 'null');
    if (saved?.fingerprint === fingerprint && saved.data?.orderId) {
      const response = await fetch('/api/orders?id=' + encodeURIComponent(saved.data.orderId) + '&pix=1', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const data = await response.json();
      if (response.ok) { showPayment(data); return; }
      if (![404, 409, 422].includes(response.status)) throw new Error(data.error || 'Não foi possível recuperar seu pedido. Tente novamente.');
      sessionStorage.removeItem('anit-pix-order'); sessionStorage.removeItem('anit-pix-attempt');
    }
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Não foi possível consultar os produtos. Recarregue a página.');
    const products = await response.json();
    cart = cart.map(item => {
      const product = products.find(p => item.id ? p.id === item.id : p.name === item.name);
      if (!product || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 || item.qty > product.stock) throw new Error('Produto indisponível ou estoque insuficiente. Revise o carrinho.');
      subtotal += Number(product.price) * item.qty;
      const row = document.createElement('p'); const name = document.createElement('span'); const price = document.createElement('strong');
      name.textContent = item.qty + ' × ' + product.name; price.textContent = money(product.price * item.qty); row.append(name, price); $('items').append(row);
      return { id: product.id, qty: item.qty };
    });
    const coupon = sessionStorage.getItem('anit-checkout-coupon') || '';
    discount = coupon === 'PRINCESS10' ? Math.round(subtotal * 10) / 100 : 0;
    estimate();
    if (shippingEnabled) {
      resetShipping();
      $('calculate').onclick = async () => {
        if (!hasAddress()) { message('Salve seu endereço antes de calcular o frete.'); return; }
        const address = window.anitShippingAddress;
        const postalCode = address.postal_code;
        resetShipping(); $('calculate').disabled = true; $('shipping-message').textContent = 'Consultando transportadoras…';
        try {
          const current = (await client.auth.getSession()).data.session;
          if (!current) throw new Error('Sessão expirada. Faça login novamente.');
          const response = await fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.access_token }, body: JSON.stringify({ postalCode, items: cart }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Não foi possível calcular o frete.');
          if (window.anitShippingAddress !== address) throw new Error('Endereço alterado. Salve e calcule o frete novamente.');
          if (!Array.isArray(data.options) || data.options.length < 2 || data.sandbox) throw new Error('Frete ainda indisponível para finalizar esta compra.');
          shippingExpires = Date.parse(data.expiresAt);
          if (!Number.isFinite(shippingExpires) || shippingExpires <= Date.now()) throw new Error('Cotação expirada. Calcule novamente.');
          for (const option of data.options) {
            const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
            input.type = 'radio'; input.name = 'shipping'; input.value = option.quoteId;
            text.textContent = option.name + ' · ' + money(option.price) + ' · ' + option.days + ' dias úteis';
            input.onchange = () => { selectedShipping = option; estimate(); refreshButton(); };
            label.append(input, text); $('shipping-options').append(label);
          }
          $('shipping-message').textContent = 'Escolha a modalidade de entrega.';
          setTimeout(() => { if (shippingExpires <= Date.now()) { resetShipping(); $('shipping-message').textContent = 'Cotação expirada. Calcule novamente.'; } }, shippingExpires - Date.now() + 100);
        } catch (error) { $('shipping-message').textContent = error.message; }
        finally { $('calculate').disabled = !hasAddress(); }
      };
    }
    const attempt = JSON.parse(sessionStorage.getItem('anit-pix-attempt') || 'null');
    const orderId = attempt?.fingerprint === fingerprint ? attempt.orderId : crypto.randomUUID();
    sessionStorage.setItem('anit-pix-attempt', JSON.stringify({ fingerprint, orderId }));
    window.addEventListener('anit:address-changed', () => { if (shippingEnabled) resetShipping(); refreshButton(); message(!hasAddress() ? 'Cadastre e salve um endereço completo para continuar.' : shippingEnabled ? 'Calcule e selecione o frete para continuar.' : 'Confira os itens e o endereço antes de gerar o Pix.'); });
    refreshButton(); message(!hasAddress() ? 'Cadastre e salve um endereço completo para continuar.' : shippingEnabled ? 'Calcule e selecione o frete para continuar.' : 'Confira os itens e o endereço antes de gerar o Pix.');
    $('generate').onclick = async () => {
      if (busy) return;
      if (!canGenerate()) { message(hasAddress() ? 'Calcule e selecione um frete válido para continuar.' : 'Cadastre e salve um endereço completo para continuar.'); $('endereco').scrollIntoView(); return; }
      busy = true; refreshButton(); message('Criando pedido…');
      try {
        session = (await client.auth.getSession()).data.session;
        if (!session) throw new Error('Sessão expirada. Faça login novamente.');
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ orderId, items: cart, coupon, ...(shippingEnabled ? { shippingQuoteId: selectedShipping.quoteId } : {}) }) });
        const data = await response.json();
        if (!response.ok || !data.success) {
          if (data.code === 'ADDRESS_REQUIRED') window.anitShippingAddress = null;
          throw new Error(data.error || 'Não foi possível gerar o Pix.');
        }
        showPayment(data);
        // Personal address/payment details are retrieved from the server on recovery.
        sessionStorage.setItem('anit-pix-order', JSON.stringify({ fingerprint, data: { orderId: data.orderId } }));
      } catch (error) { message(error.message); }
      finally { busy = false; refreshButton(); }
    };
  } catch (error) { message(error.message || 'Não foi possível carregar o pedido.'); }
})();
