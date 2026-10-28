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
    var SHIPPING = 4.5;
    var KEY = 'ss_cart_v2';

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
        foot.innerHTML =
            '<div class="tot"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
            '<div class="tot"><span>UK delivery, tracked</span><span>' + money(SHIPPING) + '</span></div>' +
            '<div class="tot grand"><span>Total</span><span>' + money(sub + SHIPPING) + '</span></div>' +
            '<button class="btn btn-block" type="button" data-checkout>Checkout securely <span class="arr">&rarr;</span></button>' +
            '<p class="err" role="alert"></p>';
    }

    function onDrawerClick(e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.inc) add(t.dataset.inc, 1);
        else if (t.dataset.dec) setQty(t.dataset.dec, qtyOf(t.dataset.dec) - 1);
        else if (t.dataset.rm) setQty(t.dataset.rm, 0);
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
        btn.disabled = true; btn.innerHTML = 'Opening secure checkout';
        fetch('/api/checkout', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart.map(function (l) { return { id: l.id, qty: l.qty }; }) })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
              if (res.ok && res.j.url) { window.location.href = res.j.url; return; }
              throw new Error(res.j && res.j.error || 'Checkout failed');
          })
          .catch(function (e) {
              btn.disabled = false; btn.innerHTML = 'Checkout securely <span class="arr">&rarr;</span>';
              if (err) err.textContent = 'Sorry, checkout could not open. Please try again or email hello@stagandsteel.co.uk.';
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
        var show = function () { v.classList.add('ready'); };
        if (v.readyState >= 2) show(); else v.addEventListener('loadeddata', show, { once: true });
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
        render(); initHeader(); initReveal(); initHero(); initGallery(); initBuy();
        if (document.body.hasAttribute('data-clear-cart')) { cart = []; save(cart); render(); }
    });
})();
