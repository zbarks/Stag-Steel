/* Stag & Steel Portal. Built by Barker Digital.
   Reads orders from /api/portal-orders (password protected) and
   draws everything in the browser. Money is in pence. */
(function () {
  'use strict';
  var SERVICES = {
    'rm-tracked-48': 'Royal Mail Tracked 48',
    'rm-tracked-24': 'Royal Mail Tracked 24',
    'rm-signed-1st': 'Royal Mail Signed For 1st Class',
    'rm-signed-2nd': 'Royal Mail Signed For 2nd Class',
    'rm-special': 'Royal Mail Special Delivery',
    'inpost': 'InPost',
    'other': 'Other courier'
  };
  var NAMES = { 'stag-opener': 'The Stag Opener', 'dog-chew': 'Antler Dog Chew', 'the-bundle': 'The Bundle' };
  var TITLES = { overview: 'Overview', orders: 'Orders', products: 'Products', customers: 'Customers' };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var state = { orders: [], days: 30, filter: 'all', q: '', page: 'overview', open: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function gbp(p) { return '£' + (Math.round(p) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function gbp0(p) { return '£' + Math.round(p / 100).toLocaleString('en-GB'); }
  function dateStr(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function timeStr(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function counts(o) { return !o.exclude_from_revenue; }
  function units(o) {
    var n = 0, k;
    for (k in o.skus) n += Number(o.skus[k]) || 0;
    if (!n) o.items.forEach(function (i) { n += Number(i.quantity) || 0; });
    return n;
  }
  function town(o) { var a = o.shipping_address || {}; return [a.city, a.postal_code].filter(Boolean).join(' '); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600); }

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('Request failed (' + r.status + ')'));
        return d;
      });
    });
  }

  function load() {
    $('#status').textContent = 'Loading';
    return api('/api/portal-orders').then(function (d) {
      state.orders = d.orders || [];
      $('#notice').hidden = true;
      $('#status').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      render();
    }).catch(function (e) {
      $('#status').textContent = 'Offline';
      var n = $('#notice'); n.hidden = false;
      n.textContent = e.message + ' If this keeps happening, check that the Supabase project is running.';
    });
  }

  // ---------- helpers on the data ----------
  function inRange(o) {
    if (!state.days) return true;
    return new Date(o.created_at).getTime() >= Date.now() - state.days * 864e5;
  }
  function revenue(list) { return list.filter(counts).reduce(function (s, o) { return s + o.amount_total; }, 0); }
  function toSend() { return state.orders.filter(function (o) { return o.status !== 'shipped'; }); }

  // ---------- Overview ----------
  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi__label">' + esc(label) + '</div><div class="kpi__value">' + esc(value) + '</div><div class="kpi__sub">' + esc(sub || '') + '</div></div>';
  }
  function renderOverview() {
    var list = state.orders.filter(inRange);
    var rev = revenue(list), n = list.filter(counts).length;
    var u = list.filter(counts).reduce(function (s, o) { return s + units(o); }, 0);
    $('#kpis').innerHTML =
      kpi('Revenue', gbp(rev), 'includes shipping') +
      kpi('Orders', n, list.length - n ? (list.length - n) + ' left out' : '') +
      kpi('Units sold', u, '') +
      kpi('Average order', n ? gbp(rev / n) : '£0.00', '') +
      kpi('To send', toSend().length, 'all time');
    drawChart(list);

    var ts = toSend().slice().reverse();
    $('#toShip').innerHTML = ts.length ? ts.slice(0, 6).map(function (o) {
      return '<button class="mini" style="width:100%;text-align:left" data-open="' + esc(o.id) + '"><span>' + esc(o.customer_name || o.customer_email || 'Customer') +
        '<br><span class="muted" style="font-size:.76rem">' + esc(town(o)) + '</span></span><span class="muted">' + esc(dateStr(o.created_at)) + '</span></button>';
    }).join('') : '<p class="muted">Nothing waiting. Everything has gone out.</p>';

    $('#latest').innerHTML = state.orders.length ? state.orders.slice(0, 6).map(function (o) {
      return '<button class="mini" style="width:100%;text-align:left" data-open="' + esc(o.id) + '"><span>' + esc(o.customer_name || o.customer_email || 'Customer') +
        '<br><span class="muted" style="font-size:.76rem">' + esc(timeStr(o.created_at)) + '</span></span><span>' + gbp(o.amount_total) + '</span></button>';
    }).join('') : '<p class="muted">No orders yet.</p>';
  }

  function drawChart(list) {
    var days = state.days || 0, byDay = {}, keys = [], i, d;
    if (!days) {
      var first = list.reduce(function (m, o) { var t = new Date(o.created_at).getTime(); return t < m ? t : m; }, Date.now());
      days = Math.min(120, Math.max(14, Math.ceil((Date.now() - first) / 864e5) + 1));
    }
    for (i = days - 1; i >= 0; i--) { d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); byDay[d] = 0; keys.push(d); }
    list.filter(counts).forEach(function (o) { var k = (o.created_at || '').slice(0, 10); if (k in byDay) byDay[k] += o.amount_total; });
    var max = Math.max.apply(null, keys.map(function (k) { return byDay[k]; }));
    $('#chartNote').textContent = days + ' days';
    $('#chart').innerHTML = max ? keys.map(function (k) {
      var h = Math.max(1, Math.round(byDay[k] / max * 100));
      return '<div class="chart__col" data-tip="' + esc(dateStr(k) + ': ' + gbp(byDay[k])) + '"><div class="chart__bar" style="height:' + (byDay[k] ? h : 1) + '%;' + (byDay[k] ? '' : 'opacity:.2') + '"></div></div>';
    }).join('') : '<div class="chart__empty">No sales in this period.</div>';
  }

  // ---------- Orders ----------
  function renderOrders() {
    var q = state.q.toLowerCase();
    var list = state.orders.filter(function (o) {
      if (state.filter === 'paid' && o.status === 'shipped') return false;
      if (state.filter === 'shipped' && o.status !== 'shipped') return false;
      if (!q) return true;
      return (o.customer_name + ' ' + o.customer_email + ' ' + town(o) + ' ' + o.shipping_name).toLowerCase().indexOf(q) !== -1;
    });
    $('#orderList').innerHTML = list.length ? list.map(function (o) {
      var sent = o.status === 'shipped';
      return '<button class="row" data-open="' + esc(o.id) + '">' +
        '<div><div class="row__name">' + esc(o.customer_name || o.customer_email || 'Customer') + '</div><div class="row__sub">' + esc(o.customer_email) + '</div></div>' +
        '<div><div>' + esc(timeStr(o.created_at)) + '</div><div class="row__sub">' + esc(town(o)) + '</div></div>' +
        '<div class="row__amt">' + gbp(o.amount_total) + (o.exclude_from_revenue ? '<div class="row__sub">left out</div>' : '') + '</div>' +
        '<div style="text-align:right"><span class="tag ' + (sent ? 'tag--shipped' : 'tag--paid') + '">' + (sent ? 'Sent' : 'To send') + '</span></div></button>';
    }).join('') : '<div class="empty">No orders match.</div>';
  }

  // ---------- Products ----------
  function productStats() {
    var map = {};
    state.orders.filter(counts).forEach(function (o) {
      o.items.forEach(function (it) {
        var name = it.name || 'Item';
        if (!map[name]) map[name] = { name: name, units: 0, pence: 0 };
        map[name].units += Number(it.quantity) || 0;
        map[name].pence += Number(it.amount_total) || 0;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.pence - a.pence; });
  }
  function renderProducts() {
    var ps = productStats(), total = ps.reduce(function (s, p) { return s + p.pence; }, 0);
    $('#productCards').innerHTML = ps.length ? ps.map(function (p) {
      var pct = total ? Math.round(p.pence / total * 100) : 0;
      return '<div class="pcard"><h3>' + esc(p.name) + '</h3><div class="pcard__nums"><div><b>' + p.units + '</b><span>Sold</span></div><div><b>' + gbp0(p.pence) + '</b><span>Revenue</span></div></div>' +
        '<div class="share"><i style="width:' + pct + '%"></i></div><p class="muted" style="margin-top:6px;font-size:.76rem">' + pct + '% of product sales</p></div>';
    }).join('') : '<div class="card empty">No sales yet.</div>';
  }

  // ---------- Customers ----------
  function renderCustomers() {
    var map = {};
    state.orders.filter(counts).forEach(function (o) {
      var key = (o.customer_email || o.customer_name || o.id).toLowerCase();
      if (!map[key]) map[key] = { name: o.customer_name || o.customer_email, email: o.customer_email, orders: 0, pence: 0, last: o.created_at, town: town(o) };
      map[key].orders += 1; map[key].pence += o.amount_total;
      if (o.created_at > map[key].last) map[key].last = o.created_at;
    });
    var cs = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.pence - a.pence; });
    var repeat = cs.filter(function (c) { return c.orders > 1; }).length;
    $('#custKpis').innerHTML = kpi('Customers', cs.length, '') + kpi('Repeat buyers', repeat, cs.length ? Math.round(repeat / cs.length * 100) + '% of customers' : '') +
      kpi('Average spend', cs.length ? gbp(cs.reduce(function (s, c) { return s + c.pence; }, 0) / cs.length) : '£0.00', 'per customer');
    $('#custList').innerHTML = cs.length ? cs.slice(0, 200).map(function (c) {
      return '<div class="row"><div><div class="row__name">' + esc(c.name) + '</div><div class="row__sub">' + esc(c.email) + '</div></div>' +
        '<div><div>' + c.orders + (c.orders === 1 ? ' order' : ' orders') + '</div><div class="row__sub">' + esc(c.town) + '</div></div>' +
        '<div class="row__amt">' + gbp(c.pence) + '</div><div class="row__sub" style="text-align:right">Last ' + esc(dateStr(c.last)) + '</div></div>';
    }).join('') : '<div class="empty">No customers yet.</div>';
  }

  // ---------- Drawer ----------
  function addrText(o) {
    var a = o.shipping_address || {};
    return [o.shipping_name || o.customer_name, a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join('\n');
  }
  function openDrawer(id) {
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    state.open = id;
    var sent = o.status === 'shipped';
    var items = o.items.map(function (i) { return '<div class="line"><span>' + esc(i.quantity) + ' × ' + esc(i.name) + '</span><span>' + gbp(i.amount_total) + '</span></div>'; }).join('');
    var opts = Object.keys(SERVICES).map(function (k) { return '<option value="' + k + '">' + esc(SERVICES[k]) + '</option>'; }).join('');
    $('#drawerPanel').innerHTML =
      '<div class="dh"><div><h3>' + esc(o.customer_name || 'Order') + '</h3><div class="muted">' + esc(timeStr(o.created_at)) + '</div></div><button class="x" data-close aria-label="Close">✕</button></div>' +
      '<span class="tag ' + (sent ? 'tag--shipped' : 'tag--paid') + '">' + (sent ? 'Sent' : 'To send') + '</span>' +
      '<div class="sec"><h4>Items</h4>' + items +
        '<div class="line"><span class="muted">Shipping</span><span>' + gbp(o.shipping_total) + '</span></div>' +
        '<div class="line line--total"><span>Total</span><span>' + gbp(o.amount_total) + '</span></div></div>' +
      '<div class="sec"><h4>Send to</h4><div class="addr">' + esc(addrText(o)) + '</div><div class="muted" style="margin-top:6px">' + esc(o.customer_email) + '</div>' +
        (o.customer_phone ? '<div style="margin-top:4px"><a href="tel:' + esc(o.customer_phone) + '" style="color:inherit">' + esc(o.customer_phone) + '</a></div>' : '') +
        '<div class="btns"><button class="btn btn--ghost" id="copyAddr">Copy address</button></div></div>' +
      (sent ?
        '<div class="sec"><h4>Dispatch</h4><div>' + esc(SERVICES[o.shipping_service] || o.shipping_service || 'Sent') + '</div>' +
          (o.tracking_number ? '<div class="muted">Tracking ' + esc(o.tracking_number) + '</div>' : '') +
          '<div class="muted">' + esc(o.shipped_at ? timeStr(o.shipped_at) : '') + '</div>' +
          '<div class="btns"><button class="btn btn--ghost" id="unship">Mark as not sent</button></div></div>' :
        '<div class="sec"><h4>Mark as sent</h4><label class="f" for="svc">Service</label><select class="in" id="svc">' + opts + '</select>' +
          '<label class="f" for="trk">Tracking number (optional)</label><input class="in" id="trk" autocomplete="off" maxlength="60">' +
          '<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px;"><input type="checkbox" id="emailCust" checked> Email the customer that it is on its way</label>' +
          '<div class="btns"><button class="btn btn--solid" id="ship">Mark as sent</button></div></div>') +
      '<div class="sec"><h4>Revenue</h4><div class="muted" style="margin-bottom:8px">Leave out test or free orders so they do not count in the figures.</div>' +
        '<button class="btn btn--ghost" id="excl">' + (o.exclude_from_revenue ? 'Count in revenue' : 'Leave out of revenue') + '</button></div>';
    $('#drawer').classList.add('is-open'); $('#drawer').setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() { state.open = null; $('#drawer').classList.remove('is-open'); $('#drawer').setAttribute('aria-hidden', 'true'); }

  function act(body, btn, okMsg) {
    if (btn) btn.disabled = true;
    return api('/api/portal-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (d) {
      var o = state.orders.filter(function (x) { return x.id === body.id; })[0];
      if (o && d.order) Object.assign(o, d.order);
      toast(body.notify ? (d.emailed ? okMsg + ', customer emailed' : okMsg + ', but the email did not send') : okMsg); render(); if (state.open) openDrawer(state.open);
    }).catch(function (e) { toast(e.message); if (btn) btn.disabled = false; });
  }

  // ---------- wiring ----------
  function render() {
    var n = toSend().length, c = $('#navCount'); c.textContent = n; c.hidden = !n;
    if (state.page === 'overview') renderOverview();
    if (state.page === 'orders') renderOrders();
    if (state.page === 'products') renderProducts();
    if (state.page === 'customers') renderCustomers();
  }
  function go(p) {
    state.page = p;
    $$('.page').forEach(function (s) { s.hidden = s.id !== p; });
    $$('#nav button').forEach(function (b) { b.classList.toggle('is-on', b.dataset.go === p); });
    $('#title').textContent = TITLES[p]; $('#side').classList.remove('is-open'); render();
    if (location.hash !== '#/' + p) history.replaceState(null, '', '#/' + p);
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-go]'))) return go(el.dataset.go);
    if ((el = t.closest('[data-open]'))) return openDrawer(el.dataset.open);
    if (t.closest('[data-close]') || t.id === 'drawerBack') return closeDrawer();
    if ((el = t.closest('#range button'))) { state.days = Number(el.dataset.d); $$('#range button').forEach(function (b) { b.classList.toggle('is-on', b === el); }); return render(); }
    if ((el = t.closest('#tabs button'))) { state.filter = el.dataset.f; $$('#tabs button').forEach(function (b) { b.classList.toggle('is-on', b === el); }); return render(); }
    if (t.closest('#refresh')) return load();
    if (t.closest('#menu')) return $('#side').classList.toggle('is-open');
    var o = state.orders.filter(function (x) { return x.id === state.open; })[0];
    if (!o) return;
    if (t.closest('#copyAddr')) { try { navigator.clipboard.writeText(addrText(o)).then(function () { toast('Address copied'); }); } catch (_) { toast('Could not copy'); } return; }
    if (t.closest('#ship')) return act({ id: o.id, action: 'ship', service: $('#svc').value, tracking: $('#trk').value, notify: $('#emailCust') ? $('#emailCust').checked : false }, t.closest('#ship'), 'Marked as sent');
    if (t.closest('#unship')) return act({ id: o.id, action: 'unship' }, t.closest('#unship'), 'Marked as not sent');
    if (t.closest('#excl')) return act({ id: o.id, action: 'exclude', value: !o.exclude_from_revenue }, t.closest('#excl'), o.exclude_from_revenue ? 'Counted in revenue' : 'Left out of revenue');
  });
  $('#search').addEventListener('input', function (e) { state.q = e.target.value.trim(); renderOrders(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  var start = (location.hash || '').replace(/^#\/?/, '');
  go(TITLES[start] ? start : 'overview');
  load();
  setInterval(function () { if (!document.hidden) load(); }, 120000);
})();
