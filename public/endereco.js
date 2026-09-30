(function () {
  'use strict';
  const root = document.getElementById('endereco');
  if (!root) return;
  const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const fields = [
    ['recipient', 'Nome de quem recebe', 'name'], ['postal_code', 'CEP', 'postal-code'],
    ['street', 'Rua / Avenida', 'address-line1'], ['number', 'Número (ou S/N)', ''],
    ['complement', 'Complemento (opcional)', 'address-line2'], ['neighborhood', 'Bairro', ''],
    ['city', 'Cidade', 'address-level2']
  ];
  root.innerHTML = '<h2>Endereço de entrega</h2><p>Cadastre e salve um endereço completo antes de gerar o Pix.</p><form id="address-form"><fieldset disabled class="address-fields"><div class="address-grid">' + fields.map(([key, label, autocomplete]) =>
    '<label for="address-' + key + '">' + label + '<input id="address-' + key + '" name="' + key + '" maxlength="' + (key === 'postal_code' ? '9' : '200') + '" ' + (key === 'complement' ? '' : 'required ') + (autocomplete ? 'autocomplete="shipping ' + autocomplete + '" ' : '') + (key === 'postal_code' ? 'inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000"' : '') + '></label>'
  ).join('') + '<label for="address-state">Estado<select id="address-state" name="state" required autocomplete="shipping address-level1"><option value="">Selecione</option>' + states.map(state => '<option>' + state + '</option>').join('') + '</select></label></div><button type="submit">Salvar endereço</button></fieldset></form><p id="address-message" role="status" aria-live="polite">Carregando endereço…</p>';
  const form = root.querySelector('form'), message = root.querySelector('#address-message');
  let client, session;
  function publish(address) {
    window.anitShippingAddress = address;
    window.dispatchEvent(new CustomEvent('anit:address-changed', { detail: address }));
  }
  function valid(address) {
    return address && fields.filter(([key]) => key !== 'complement').every(([key]) => typeof address[key] === 'string' && address[key].trim().length > 0 && address[key].length <= 200)
      && /^[0-9]{8}$/.test(address.postal_code) && address.postal_code !== '00000000' && states.includes(address.state);
  }
  window.anitValidShippingAddress = valid;
  form.addEventListener('input', () => { publish(null); message.textContent = 'Salve as alterações para usar este endereço na compra.'; });
  form.addEventListener('change', () => { publish(null); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const address = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(address)) address[key] = address[key].trim();
    address.postal_code = address.postal_code.replace(/\D/g, '');
    if (!valid(address)) { message.textContent = 'Preencha todos os campos e informe um CEP válido.'; return; }
    const button = form.querySelector('button'); button.disabled = true; publish(null); message.textContent = 'Salvando endereço…';
    try {
      const current = (await client.auth.getSession()).data.session;
      if (!current || current.user.id !== session.user.id) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await client.from('profiles').update({ shipping_address: address }).eq('id', current.user.id).select('shipping_address').single();
      if (error || !valid(data?.shipping_address)) throw new Error('Não foi possível salvar o endereço. Tente novamente.');
      publish(data.shipping_address); message.textContent = 'Endereço salvo. Ele será usado no seu próximo pedido.';
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  window.anitAddressReady = (async () => {
    try {
      client = window.supabaseClient || window.supabase.createClient(window.__SUPABASE_URL, window.__SUPABASE_ANON_KEY);
      window.supabaseClient = client;
      session = (await client.auth.getSession()).data.session;
      if (!session) throw new Error('Faça login para cadastrar seu endereço.');
      const { data, error } = await client.from('profiles').select('shipping_address').eq('id', session.user.id).single();
      if (error) throw new Error('Não foi possível carregar o endereço. Recarregue a página.');
      const address = valid(data?.shipping_address) ? data.shipping_address : null;
      if (address) for (const key of [...fields.map(([key]) => key), 'state']) form.elements[key].value = address[key] || '';
      root.querySelector('fieldset').disabled = false;
      publish(address); message.textContent = address ? 'Endereço salvo. Confira os dados antes de finalizar.' : 'Você ainda não tem endereço de entrega. Preencha os campos abaixo.';
      client.auth.onAuthStateChange((event, current) => { if (event === 'SIGNED_OUT' || (current && current.user.id !== session.user.id)) { publish(null); root.querySelector('fieldset').disabled = true; } });
    } catch (error) { publish(null); message.textContent = error.message; }
    return { client, session, address: window.anitShippingAddress };
  })();
})();
