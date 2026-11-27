/* Stag & Steel storefront script.
   Cart lives in localStorage. Prices here are for display only:
   api/checkout.js holds the real prices and always wins. */
(function () {
    'use strict';

    var CATALOGUE = {
        'stag-opener': { name: 'The Stag Opener', price: 15, img: ['assets/opener-main-sm.jpg'], url: 'stag-opener.html' },
        'dog-chew':    { name: 'Antler Dog Chew', price: 10, img: ['assets/chew-main-sm.jpg'], url: 'dog-chew.html' },
        'the-bundle':  { name: 'The Bundle', price: 20, img: ['assets/opener-main-sm.jpg', 'assets/chew-main-sm.jpg'], url: 'bundle.html', note: 'Opener and dog chew' }
    };
    var SHIPPING_PER_BOX = 4.5, SHIPPING_CAP = 20;
    var FREE_SHIPPING_CODES = ['INPERSON']; // display only: api/checkout.js enforces
    var CODE_KEY = 'ss_code_v1';
    var code = '';
    try { code = localStorage.getItem(CODE_KEY) || ''; } catch (e) {}
    function freeShip() { return FREE_SHIPPING_CODES.indexOf(code) !== -1; }
    // Box capacity: 6 openers/chews per box, 3 bundles per box, 6 items max (opener=2, chew=2, bundle=4, box=12).
    var SLOTS = { 'stag-opener': 2, 'dog-chew': 2, 'the-bundle': 4 }, BOX_SLOTS = 12;
    function unitsOf() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
    function minBoxes() { var s = cart.reduce(function (t, l) { return t + (SLOTS[l.id] || 2) * l.qty; }, 0); return Math.max(1, Math.ceil(s / BOX_SLOTS)); }
    function boxesNow() { return (pack === 'separate') ? Math.max(unitsOf(), 1) : minBoxes(); }
    function shippingFor(boxes) { return freeShip() ? 0 : Math.min(SHIPPING_CAP, SHIPPING_PER_BOX * boxes); }
    function setCode(c) {
        code = (c || '').trim().toUpperCase();
        try { localStorage.setItem(CODE_KEY, code); } catch (e) {}
        render();
    }
    var KEY = 'ss_cart_v2';
    var PACK_KEY = 'ss_pack_v1', NOTE_KEY = 'ss_note_v1';
    var pack = '', note = '';
    try { pack = localStorage.getItem(PACK_KEY) || ''; note = localStorage.getItem(NOTE_KEY) || ''; } catch (e) {}
    if (pack !== 'one-box' && pack !== 'separate') pack = '';
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function setPack(v) { pack = v; try { localStorage.setItem(PACK_KEY, v); } catch (e) {} }
    function setNote(v) { note = v.slice(0, 300); try { localStorage.setItem(NOTE_KEY, note); } catch (e) {} }

    /* ---------- storage ---------- */
    function load() {
        try {
            var c = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(c) ? c.filter(function (l) { return CATALOGUE[l.id] && l.qty > 0; }) : [];
        } catch (e) { return []; }
    }
    function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
    var cart = load();

    function qtyOf(id) { var l = cart.find(function (x) { return x.id === id; }); return l ? l.qty : 0; }
    function setQty(id, q) {
        q = Math.max(0, Math.min(10, q | 0));
        var l = cart.find(function (x) { return x.id === id; });
        if (l) l.qty = q; else if (q > 0) cart.push({ id: id, qty: q });
        cart = cart.filter(function (x) { return x.qty > 0; });
        save(cart); render();
    }
    function add(id, q) { setQty(id, qtyOf(id) + (q || 1)); }
    var money = function (n) { return '£' + (n % 1 ? n.toFixed(2) : n); };

    /* ---------- drawer ---------- */
    var drawer, body, foot;
    function buildDrawer() {
        var bg = document.createElement('div'); bg.className = 'drawer-bg'; bg.addEventListener('click', closeCart);
        drawer = document.createElement('aside');
        drawer.className = 'drawer'; drawer.setAttribute('aria-label', 'Your basket'); drawer.setAttribute('aria-hidden', 'true');
        drawer.innerHTML =
            '<div class="drawer-head"><h3>Your basket</h3><button class="drawer-close" type="button">Close</button></div>' +
            '<div class="drawer-body"></div>' +
            '<div class="drawer-foot"></div>';
        document.body.appendChild(bg); document.body.appendChild(drawer);
        body = drawer.querySelector('.drawer-body'); foot = drawer.querySelector('.drawer-foot');
        drawer.querySelector('.drawer-close').addEventListener('click', closeCart);
        drawer.addEventListener('change', onDrawerChange);
        drawer.addEventListener('input', onDrawerInput);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCart(); });
    }
    function openCart() { document.body.classList.add('cart-open'); drawer.setAttribute('aria-hidden', 'false'); }
    function closeCart() { document.body.classList.remove('cart-open'); drawer.setAttribute('aria-hidden', 'true'); }

    function render() {
        var n = cart.reduce(function (s, l) { return s + l.qty; }, 0);
        document.querySelectorAll('.cart-count').forEach(function (el) { el.textContent = n; el.setAttribute('data-n', n); });
        if (!body) return;

        if (!cart.length) {
            body.innerHTML = '<div class="empty"><span class="serif it">Nothing in here yet.</span>Have a look at the shop.</div>';
            foot.innerHTML = '<a class="btn btn-block" href="shop.html">Go to the shop <span class="arr">&rarr;</span></a>';
            return;
        }

        var html = cart.map(function (l) {
            var p = CATALOGUE[l.id];
            var thumb = p.img.length > 1
                ? '<a class="thumb duo" href="' + p.url + '"><img src="' + p.img[0] + '" alt=""><img src="' + p.img[1] + '" alt=""></a>'
                : '<a class="thumb" href="' + p.url + '"><img src="' + p.img[0] + '" alt=""></a>';
            return '<div class="line">' + thumb +
                '<div><h4>' + p.name + '</h4>' +
                '<div class="mini-qty"><button type="button" data-dec="' + l.id + '" aria-label="Fewer">&minus;</button><span>' + l.qty + '</span><button type="button" data-inc="' + l.id + '" aria-label="More">+</button></div>' +
                '<button class="rm" type="button" data-rm="' + l.id + '">Remove</button></div>' +
                '<span class="lp">' + money(p.price * l.qty) + '</span></div>';
        }).join('');

        // Bundle nudge: if they have an opener and a chew bought separately, offer the swap.
        var pairs = Math.min(qtyOf('stag-opener'), qtyOf('dog-chew'));
        if (pairs > 0) {
            html += '<div class="swap"><strong>Save £' + (5 * pairs) + ' with the bundle</strong>' +
                '<p>You have an opener and a dog chew in your basket. As a bundle they are £20 instead of £25.</p>' +
                '<button class="btn" type="button" data-swap>Switch to the bundle</button></div>';
        } else if (qtyOf('stag-opener') > 0 && qtyOf('dog-chew') === 0) {
            html += '<div class="swap"><strong>Add a dog chew for £5</strong>' +
                '<p>Turn your opener into the bundle: opener and antler dog chew for £20.</p>' +
                '<button class="btn" type="button" data-upgrade="stag-opener">Make it a bundle</button></div>';
        } else if (qtyOf('dog-chew') > 0 && qtyOf('stag-opener') === 0) {
            html += '<div class="swap"><strong>Add the opener for £10</strong>' +
                '<p>Turn your dog chew into the bundle: antler dog chew and Stag Opener for £20.</p>' +
                '<button class="btn" type="button" data-upgrade="dog-chew">Make it a bundle</button></div>';
        }
        body.innerHTML = html;

        var sub = cart.reduce(function (s, l) { return s + CATALOGUE[l.id].price * l.qty; }, 0);
        var boxes = boxesNow(), SHIPPING = shippingFor(boxes);
        foot.innerHTML =
            '<div class="tot"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
            '<div class="tot"><span>' + (freeShip() ? 'Delivery (code ' + code + ')' : 'UK delivery, tracked (' + boxes + (boxes === 1 ? ' box' : ' boxes') + ')') + '</span><span>' + (freeShip() ? 'Free' : money(SHIPPING)) + '</span></div>' +
            '<form class="code" data-code>' +
                '<input type="text" name="code" placeholder="Discount code" autocomplete="off" aria-label="Discount code" value="' + (freeShip() ? '' : code) + '">' +
                '<button type="submit" class="btn">Apply</button></form>' +
                (freeShip() ? '<p class="code-ok">Code ' + code + ' applied. <button type="button" class="rm" data-code-clear>Remove</button></p>' : '') +
            '<div class="tot grand"><span>Total</span><span>' + money(sub + SHIPPING) + '</span></div>' +
            packHtml(n, minBoxes()) +
            '<button class="btn btn-block" type="button" data-checkout>Checkout securely <span class="arr">&rarr;</span></button>' +
            '<p class="err" role="alert"></p>';
    }

    function packExplain(n, mb) {
        var names = { 'stag-opener': ['stag opener', 'stag openers'], 'dog-chew': ['dog chew', 'dog chews'], 'the-bundle': ['bundle', 'bundles'] };
        var parts = cart.map(function (l) { return l.qty + ' ' + names[l.id][l.qty === 1 ? 0 : 1]; });
        var list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
        if (mb <= 1) return 'Your ' + list + ' fit together in one box.';
        var hasB = qtyOf('the-bundle') > 0, hasO = qtyOf('stag-opener') + qtyOf('dog-chew') > 0;
        var rule = hasB && hasO ? 'a box holds 6 items and a bundle counts as 2' : hasB ? 'a box holds 3 bundles' : 'a box holds 6 items';
        return 'Your ' + list + ' need ' + mb + ' boxes, as ' + rule + '.';
    }

    function packHtml(n, mb) {
        var h = '<div class="pack">';
        if (n > 1) {
            h += '<p class="pack-h">How should we pack it?</p>' +
                '<label class="pack-opt"><input type="radio" name="pack" value="one-box"' + (pack === 'one-box' ? ' checked' : '') + '>' +
                    '<span><strong>' + (mb > 1 ? 'Packed together' : 'All in one box') + '</strong><small>' + packExplain(n, mb) + '</small></span></label>' +
                '<label class="pack-opt"><input type="radio" name="pack" value="separate"' + (pack === 'separate' ? ' checked' : '') + '>' +
                    '<span><strong>Separate boxes</strong><small>Each item in its own box (' + n + ' boxes), handy for gifts</small></span></label>';
        }
        h += '<label class="pack-note"><span>Leave a note <em>(optional)</em></span>' +
            '<textarea name="note" rows="2" maxlength="300" placeholder="Gift message, delivery instructions, anything we should know">' + esc(note) + '</textarea></label></div>';
        return h;
    }

    function onDrawerChange(e) {
        var t = e.target;
        if (t && t.name === 'pack') { setPack(t.value); render(); }
    }
    function onDrawerInput(e) {
        var t = e.target;
        if (t && t.name === 'note') setNote(t.value);
    }

    function onDrawerClick(e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.inc) add(t.dataset.inc, 1);
        else if (t.dataset.dec) setQty(t.dataset.dec, qtyOf(t.dataset.dec) - 1);
        else if (t.dataset.rm) setQty(t.dataset.rm, 0);
        else if (t.hasAttribute('data-code-clear')) setCode('');
        else if (t.hasAttribute('data-swap')) {
            var p = Math.min(qtyOf('stag-opener'), qtyOf('dog-chew'));
            cart = cart.map(function (l) { if (l.id === 'stag-opener' || l.id === 'dog-chew') l.qty -= p; return l; });
            add('the-bundle', p); toast('Switched to the bundle. You saved £' + 5 * p + '.');
        } else if (t.dataset.upgrade) {
            setQty(t.dataset.upgrade, qtyOf(t.dataset.upgrade) - 1); add('the-bundle', 1); toast('Upgraded to the bundle.');
        } else if (t.hasAttribute('data-checkout')) checkout(t);
    }

    function checkout(btn) {
        var err = foot.querySelector('.err');
        var units = cart.reduce(function (s, l) { return s + l.qty; }, 0);
        if (units > 1 && !pack) {
            if (err) err.textContent = 'Please choose how you would like it packed.';
            var po = foot.querySelector('.pack'); if (po && po.scrollIntoView) po.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }
        btn.disabled = true; btn.innerHTML = 'Opening secure checkout';
        fetch('/api/checkout', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart.map(function (l) { return { id: l.id, qty: l.qty }; }), code: code, packaging: units > 1 ? pack : 'single', note: note })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
              if (res.ok && res.j.url) { window.location.href = res.j.url; return; }
              throw new Error(res.j && res.j.error || 'Checkout failed');
          })
          .catch(function (e) {
              btn.disabled = false; btn.innerHTML = 'Checkout securely <span class="arr">&rarr;</span>';
              if (err) err.textContent = 'Sorry, checkout could not open. Please try again or email zach@barkerdigital.co.uk.';
              console.error(e);
          });
    }

    /* ---------- toast ---------- */
    var toastEl, toastT;
    function toast(msg) {
        if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
        toastEl.textContent = msg; toastEl.classList.add('show');
        clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
    }

    /* ---------- page bits ---------- */
    function initHeader() {
        var h = document.querySelector('.site-head'); if (!h) return;
        var always = h.hasAttribute('data-solid');
        var f = function () { h.classList.toggle('solid', always || window.scrollY > 40); };
        f(); window.addEventListener('scroll', f, { passive: true });

        var mm = document.querySelector('.mobile-menu');
        document.querySelectorAll('[data-menu]').forEach(function (b) {
            b.addEventListener('click', function () { mm.classList.toggle('open'); document.body.style.overflow = mm.classList.contains('open') ? 'hidden' : ''; });
        });
        document.querySelectorAll('[data-cart]').forEach(function (b) {
            b.addEventListener('click', function (e) { e.preventDefault(); if (mm) { mm.classList.remove('open'); document.body.style.overflow = ''; } openCart(); });
        });
    }

    function initReveal() {
        var els = document.querySelectorAll('.rv');
        if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
        var io = new IntersectionObserver(function (ents) {
            ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
        }, { rootMargin: '0px 0px -8% 0px' });
        els.forEach(function (e) { io.observe(e); });
    }

    function initHero() {
        var v = document.querySelector('.hero video'); if (!v) return;
        // The clip fades up from black, so start (and restart each loop) a little
        // way in. The first couple of seconds are almost completely black.
        var START = 2;
        var show = function () { v.classList.add('ready'); };
        var seek = function () { try { if (v.currentTime < START) v.currentTime = START; } catch (e) {} };
        if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
        v.addEventListener('seeked', show, { once: true });
        setTimeout(show, 2000);
        v.addEventListener('ended', function () {
            try { v.currentTime = START; } catch (e) {}
            var r = v.play && v.play(); if (r && r.catch) r.catch(function () {});
        });
        var p = v.play && v.play(); if (p && p.catch) p.catch(function () { show(); });
    }

    function initGallery() {
        var g = document.querySelector('.gallery'); if (!g) return;
        var slides = g.querySelectorAll('.stage > *');
        g.querySelectorAll('.thumbs button').forEach(function (b, i) {
            b.addEventListener('click', function () {
                slides.forEach(function (s, j) { s.classList.toggle('on', i === j); });
                g.querySelectorAll('.thumbs button').forEach(function (x, j) { x.setAttribute('aria-pressed', i === j ? 'true' : 'false'); });
            });
        });
    }

    function initBuy() {
        var q = 1, out = document.querySelector('.qty output');
        document.querySelectorAll('.qty button').forEach(function (b) {
            b.addEventListener('click', function () { q = Math.max(1, Math.min(10, q + (+b.dataset.step))); out.textContent = q; });
        });
        document.querySelectorAll('[data-add]').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = b.dataset.add, n = b.hasAttribute('data-one') ? 1 : q;
                add(id, n); openCart();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        buildDrawer();
        drawer.addEventListener('click', onDrawerClick);
        drawer.addEventListener('submit', function (e) {
            if (!e.target.hasAttribute('data-code')) return;
            e.preventDefault();
            var v = e.target.code.value.trim().toUpperCase();
            if (FREE_SHIPPING_CODES.indexOf(v) !== -1) { setCode(v); toast('Code applied. Delivery is free.'); }
            else toast('That code is not valid.');
        });
        render(); initHeader(); initReveal(); initHero(); initGallery(); initBuy();
        if (document.body.hasAttribute('data-clear-cart')) { cart = []; save(cart); render(); }
    });
})();
