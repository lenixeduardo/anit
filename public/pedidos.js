(async function () {
  'use strict';
  const admin = document.body.dataset.admin === 'true';
  const $ = id => document.getElementById(id);
  const labels = { pending: 'Aguardando Pix', paid: 'Pagamento confirmado', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
  const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = d => new Date(d).toLocaleString('pt-BR');
  let orders = [], selected = new URLSearchParams(location.search).get('id'), session, loading = false, offset = 0;
  function element(tag, text, className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  }
  async function api(path, options = {}) {
    const response = await fetch('/api/orders' + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pedido');
    return data;
  }
  function renderList() {
    const search = $('search').value.toLowerCase().trim(), status = $('filter').value;
    $('list').replaceChildren();
    const filtered = orders.filter(o => (!status || o.status === status) && [o.id, o.profiles?.name, o.profiles?.email, ...(o.order_items || []).map(i => i.products?.name)].join(' ').toLowerCase().includes(search));
    for (const order of filtered) {
      const card = element('article', undefined, 'card');
      card.append(element('h2', 'ANIT-' + order.id.slice(0, 8)), element('span', labels[order.status] || order.status, 'pill'), element('p', date(order.created_at) + ' · ' + money(order.total)));
      if (admin) card.append(element('p', (order.profiles?.name || 'Cliente sem perfil') + ' · ' + (order.profiles?.email || 'E-mail não informado')));
      const button = element('button', 'Ver detalhes'); button.onclick = () => { selected = order.id; renderDetail(); }; card.append(button); $('list').append(card);
    }
    if (!filtered.length) $('list').append(element('p', orders.length ? 'Nenhum pedido corresponde aos filtros.' : 'Você ainda não tem pedidos.'));
    $('summary').replaceChildren();
    const settled = orders.filter(o => ['paid', 'shipped', 'delivered'].includes(o.status));
    for (const [name, value] of [['Pedidos exibidos', orders.length], ['Aguardando Pix', orders.filter(o => o.status === 'pending').length], [admin ? 'Total confirmado' : 'Total em compras confirmadas', money(settled.reduce((sum, o) => sum + Number(o.total), 0))]]) {
      const box = element('div', name); box.append(element('strong', String(value))); $('summary').append(box);
    }
  }
  function renderDetail() {
    const order = orders.find(o => o.id === selected), root = $('detail'); root.replaceChildren();
    if (!order) { root.append(element('p', selected ? 'Pedido não encontrado ou indisponível nesta conta.' : 'Selecione um pedido para ver os detalhes.')); return; }
    root.append(element('h2', 'Pedido ' + order.id), element('p', labels[order.status] || order.status, 'pill'), element('p', 'Criado em ' + date(order.created_at)));
    if (admin) root.append(element('h3', 'Cliente'), element('p', (order.profiles?.name || 'Não informado') + ' · ' + (order.profiles?.email || 'E-mail não informado')));
    const items = element('ul');
    for (const item of order.order_items || []) items.append(element('li', item.quantity + ' × ' + (item.products?.name || 'Produto removido do catálogo') + ' · ' + money(item.price) + ' por unidade · ' + money(item.price * item.quantity)));
    root.append(element('h3', 'Itens'), items, element('strong', 'Total do pedido: ' + money(order.total)), element('p', 'Forma de pagamento: Pix'));
    if (order.tracking_code) root.append(element('h3', 'Rastreio'), element('p', order.tracking_code));
    const history = element('div', undefined, 'history'); history.append(element('p', date(order.created_at) + ' · Pedido criado, aguardando Pix'));
    for (const event of [...(order.order_status_history || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) history.append(element('p', date(event.created_at) + ' · ' + (labels[event.status] || event.status)));
    root.append(element('h3', 'Histórico'), history);
    if (order.status === 'pending') {
      root.append(element('p', 'O pagamento será confirmado pela loja após conferir o recebimento no banco.'));
      if (!admin) {
        const pay = element('button', 'Ver Pix do pedido');
        pay.onclick = async () => {
          pay.disabled = true;
          try {
            const data = await api('?id=' + encodeURIComponent(order.id) + '&pix=1');
            if (selected !== order.id) return;
            const qr = element('img'); qr.src = data.qr; qr.alt = 'QR Code Pix do pedido';
            const label = element('label', 'Pix Copia e Cola'); const code = element('textarea'); code.readOnly = true; code.value = data.payload; code.rows = 4; label.append(code);
            const copy = element('button', 'Copiar Pix'); copy.onclick = async () => { try { await navigator.clipboard.writeText(data.payload); $('message').textContent = 'Pix copiado.'; } catch { code.select(); $('message').textContent = 'Selecione e copie o código.'; } };
            root.append(qr, label, copy); pay.remove();
          } catch (error) { $('message').textContent = error.message; pay.disabled = false; }
        };
        root.append(pay);
      }
    }
    if (admin) {
      const transitions = { pending: [['paid', 'Confirmar recebimento do Pix'], ['cancelled', 'Cancelar pedido']], paid: [['shipped', 'Registrar envio']], shipped: [['delivered', 'Marcar como entregue']] };
      let tracking;
      if (order.status === 'paid') { const label = element('label', 'Código de rastreio'); tracking = element('input'); tracking.maxLength = 100; label.append(tracking); root.append(label); }
      for (const [status, text] of transitions[order.status] || []) {
        const button = element('button', text, status === 'cancelled' ? 'danger' : '');
        button.onclick = async () => {
          if (status === 'shipped' && tracking.value.trim().length < 3) { $('message').textContent = 'Informe o código de rastreio.'; tracking.focus(); return; }
          if (!confirm(status === 'paid' ? 'Você conferiu o recebimento deste Pix no banco? A confirmação dará baixa no estoque.' : 'Confirmar: ' + text + '?')) return;
          button.disabled = true;
          try { await api('', { method: 'PATCH', body: JSON.stringify({ id: order.id, status, tracking: tracking?.value.trim() || '', paymentVerified: status === 'paid' }) }); await load(); }
          catch (error) { $('message').textContent = error.message; button.disabled = false; }
        }; root.append(button);
      }
    }
  }
  async function load(more = false) {
    if (loading) return; loading = true; $('refresh').disabled = true;
    try { const previous = JSON.stringify(orders.find(o => o.id === selected)); const next = await api((admin ? '?scope=admin' : '?scope=own') + '&offset=' + (more ? offset : 0)); offset = more ? offset + next.length : next.length; orders = more ? [...orders, ...next.filter(o => !orders.some(old => old.id === o.id))] : next; $('more').hidden = next.length < 100; if (selected && !orders.some(o => o.id === selected)) { try { const specific = await api('?id=' + encodeURIComponent(selected) + (admin ? '&scope=admin' : '')); orders.push(...specific); } catch { /* Pedido ausente ou sem acesso. */ } } renderList(); if (previous !== JSON.stringify(orders.find(o => o.id === selected))) renderDetail(); $('message').textContent = 'Atualizado em ' + new Date().toLocaleTimeString('pt-BR') + '. Use os filtros ou carregue os pedidos anteriores.'; }
    catch (error) { $('message').textContent = error.message; }
    finally { loading = false; $('refresh').disabled = false; }
  }
  try {
    if (!window.supabase) throw new Error('Não foi possível carregar a autenticação. Recarregue a página.');
    const client = window.supabase.createClient(window.__SUPABASE_URL, window.__SUPABASE_ANON_KEY);
    session = (await client.auth.getSession()).data.session;
    if (!session) { location.href = 'login.html'; return; }
    client.auth.onAuthStateChange((event, current) => { session = current; if (!current) location.href = 'login.html'; });
    $('search').oninput = renderList; $('filter').onchange = renderList; $('refresh').onclick = () => load(); $('more').onclick = () => load(true);
    await load(); setInterval(() => { if (document.visibilityState === 'visible' && !document.activeElement?.closest('#detail')) load(); }, 30000);
  } catch (error) { $('message').textContent = error.message; }
})();
