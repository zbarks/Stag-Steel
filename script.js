/* ================================================================
   STAG & STEEL — Cart + UI scripts
   - localStorage cart (persists across sessions, across tabs)
   - Slide-in drawer
   - Toast on add
   - Stripe Checkout via /api/checkout
   ================================================================ */

(function () {
    'use strict';

    // ============================================================
    // PRODUCT CATALOGUE (client-side metadata only)
    // The serverless function is the source of truth for prices.
    // The values here are used for instant cart UI rendering before
    // any network call. They MUST match /api/checkout.js — if a
    // mismatch occurs, the server's price wins at checkout.
    // ============================================================
    const CATALOGUE = {
        'tine-opener': { name: 'The Tine Opener', price: 30.00, image: 'assets/tine_main_white.jpg', subtitle: "From the antler's outer point" },
        'stem-opener': { name: 'The Stem Opener', price: 25.00, image: 'assets/stem_main_white.jpg', subtitle: "Cut from the antler's main beam" },
        'corkscrew':   { name: 'The Corkscrew',   price: 25.00, image: 'assets/corkscrew_main_white.jpg', subtitle: "From the antler's burr — dense and short" },
        'the-set':     { name: 'The Set',         price: 40.00, image: 'assets/set_main_white.jpg', subtitle: 'Two-piece presentation box' },
    };

    const SHIPPING = 4.50; // £
    const STORAGE_KEY = 'stag_cart';

    // ============================================================
    // CART MODULE — single source of truth
    // ============================================================
    const Cart = (function () {
        function read() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.warn('Cart read failed, resetting', e);
                return [];
            }
        }

        function write(items) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch (e) {
                console.warn('Cart write failed', e);
            }
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
        }

        function getItems() { return read(); }
        function getCount() { return read().reduce((s, it) => s + (it.qty || 0), 0); }
        function getSubtotal() {
            return read().reduce((sum, it) => {
                const meta = CATALOGUE[it.id];
                if (!meta) return sum;
                return sum + meta.price * (it.qty || 0);
            }, 0);
        }

        function add(id, qty) {
            qty = Math.max(1, parseInt(qty, 10) || 1);
            if (!CATALOGUE[id]) {
                console.warn('Unknown product id:', id);
                return null;
            }
            const items = read();
            const existing = items.find(it => it.id === id);
            if (existing) existing.qty = Math.min(10, existing.qty + qty);
            else items.push({ id, qty });
            write(items);
            return CATALOGUE[id];
        }

        function setQty(id, qty) {
            qty = Math.max(0, Math.min(10, parseInt(qty, 10) || 0));
            let items = read();
            if (qty === 0) items = items.filter(it => it.id !== id);
            else {
                const existing = items.find(it => it.id === id);
                if (existing) existing.qty = qty;
                else if (CATALOGUE[id]) items.push({ id, qty });
            }
            write(items);
        }

        function remove(id) { setQty(id, 0); }

        function clear() {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: [] } }));
        }

        // Cross-tab sync
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: read() } }));
            }
        });

        return { getItems, getCount, getSubtotal, add, setQty, remove, clear };
    })();

    window.StagCart = Cart;

    // ============================================================
    // CART DRAWER
    // ============================================================
    function ensureDrawer() {
        let drawer = document.getElementById('cart-drawer');
        if (drawer) return drawer;

        drawer = document.createElement('aside');
        drawer.id = 'cart-drawer';
        drawer.className = 'cart-drawer';
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');
        drawer.innerHTML = ''
            + '<div class="cart-drawer-overlay" data-close></div>'
            + '<div class="cart-drawer-panel" role="dialog" aria-label="Cart">'
            +   '<header class="cart-drawer-head">'
            +     '<span class="cart-drawer-eyebrow">Your Cart</span>'
            +     '<button class="cart-drawer-close" type="button" data-close aria-label="Close">Close</button>'
            +   '</header>'
            +   '<div class="cart-drawer-body" id="cart-drawer-body"></div>'
            +   '<footer class="cart-drawer-foot" id="cart-drawer-foot"></footer>'
            + '</div>';
        document.body.appendChild(drawer);

        drawer.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeDrawer));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
        });
        return drawer;
    }

    function openDrawer() {
        const d = ensureDrawer();
        renderDrawer();
        d.classList.add('open');
        d.removeAttribute('aria-hidden');
        d.removeAttribute('inert');
        document.body.classList.add('no-scroll');
    }

    function closeDrawer() {
        const d = document.getElementById('cart-drawer');
        if (!d) return;
        // Move focus out of the drawer BEFORE hiding it (avoids aria-hidden focus warning)
        if (d.contains(document.activeElement) && document.activeElement.blur) {
            document.activeElement.blur();
        }
        d.classList.remove('open');
        d.setAttribute('aria-hidden', 'true');
        d.setAttribute('inert', '');
        document.body.classList.remove('no-scroll');
    }

    function fmt(n) { return '£' + n.toFixed(2); }

    function renderDrawer() {
        const drawer = document.getElementById('cart-drawer');
        if (!drawer) return;
        const body = drawer.querySelector('#cart-drawer-body');
        const foot = drawer.querySelector('#cart-drawer-foot');
        const items = Cart.getItems();

        if (items.length === 0) {
            body.innerHTML = ''
                + '<div class="cart-empty">'
                +   '<p class="cart-empty-eyebrow">Your cart is empty</p>'
                +   '<p class="cart-empty-line">Nothing here yet.</p>'
                +   '<a href="shop.html" class="btn btn-solid" data-close>Browse the Shop</a>'
                + '</div>';
            foot.innerHTML = '';
            body.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeDrawer));
            return;
        }

        let html = '<ul class="cart-items">';
        for (const it of items) {
            const meta = CATALOGUE[it.id];
            if (!meta) continue;
            const lineTotal = meta.price * it.qty;
            html += ''
                + '<li class="cart-item" data-id="' + it.id + '">'
                +   '<div class="cart-item-img"><img src="' + meta.image + '" alt="' + meta.name + '"></div>'
                +   '<div class="cart-item-meta">'
                +     '<h4>' + meta.name + '</h4>'
                +     '<span class="cart-item-sub">' + meta.subtitle + '</span>'
                +     '<div class="cart-item-controls">'
                +       '<div class="cart-qty">'
                +         '<button type="button" data-act="dec" aria-label="Decrease">&minus;</button>'
                +         '<span class="cart-qty-val">' + it.qty + '</span>'
                +         '<button type="button" data-act="inc" aria-label="Increase">+</button>'
                +       '</div>'
                +       '<button type="button" class="cart-item-remove" data-act="remove">Remove</button>'
                +     '</div>'
                +   '</div>'
                +   '<div class="cart-item-price">' + fmt(lineTotal) + '</div>'
                + '</li>';
        }
        html += '</ul>';
        body.innerHTML = html;

        body.querySelectorAll('.cart-item').forEach(li => {
            const id = li.dataset.id;
            li.querySelector('[data-act="inc"]').addEventListener('click', () => {
                const cur = Cart.getItems().find(x => x.id === id);
                Cart.setQty(id, (cur ? cur.qty : 0) + 1);
            });
            li.querySelector('[data-act="dec"]').addEventListener('click', () => {
                const cur = Cart.getItems().find(x => x.id === id);
                Cart.setQty(id, (cur ? cur.qty : 0) - 1);
            });
            li.querySelector('[data-act="remove"]').addEventListener('click', () => Cart.remove(id));
        });

        const subtotal = Cart.getSubtotal();
        const total = subtotal + SHIPPING;
        foot.innerHTML = ''
            + '<div class="cart-totals">'
            +   '<div class="cart-line"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>'
            +   '<div class="cart-line cart-line-mute"><span>UK delivery</span><span>' + fmt(SHIPPING) + '</span></div>'
            +   '<div class="cart-line cart-total"><span>Total</span><span>' + fmt(total) + '</span></div>'
            + '</div>'
            + '<button class="btn btn-solid btn-large cart-checkout" type="button" id="cart-checkout-btn">Proceed to Checkout</button>'
            + '<p class="cart-foot-note">Secure checkout via Stripe &middot; UK delivery only &middot; 1 week shipping</p>';

        document.getElementById('cart-checkout-btn').addEventListener('click', startCheckout);
    }

    // ============================================================
    // CHECKOUT
    // ============================================================
    async function startCheckout() {
        const btn = document.getElementById('cart-checkout-btn');
        if (!btn) return;
        const items = Cart.getItems();
        if (items.length === 0) return;

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Loading…';
        btn.classList.add('is-loading');

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items.map(it => ({ id: it.id, qty: it.qty })) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) {
                throw new Error(data.error || ('HTTP ' + res.status));
            }
            window.location.href = data.url;
        } catch (err) {
            console.error('Checkout failed:', err);
            btn.disabled = false;
            btn.textContent = originalText;
            btn.classList.remove('is-loading');
            showToast('Checkout failed', err.message || 'Please try again', true);
        }
    }

    // ============================================================
    // CART COUNTER (in nav)
    // ============================================================
    function updateCounters() {
        const count = Cart.getCount();
        document.querySelectorAll('.js-cart-count').forEach(el => { el.textContent = count; });
        document.querySelectorAll('.cart-btn').forEach(btn => {
            btn.dataset.hasItems = count > 0 ? 'true' : 'false';
        });
    }

    function bumpCounter() {
        document.querySelectorAll('.cart-btn').forEach(btn => {
            btn.classList.remove('cart-bump');
            void btn.offsetWidth;
            btn.classList.add('cart-bump');
        });
    }

    // ============================================================
    // TOAST
    // ============================================================
    function ensureToast() {
        let toast = document.getElementById('s-toast');
        if (toast) return toast;
        toast = document.createElement('div');
        toast.id = 's-toast';
        toast.className = 's-toast';
        toast.innerHTML = ''
            + '<span class="s-toast-tick">+</span>'
            + '<div class="s-toast-body">'
            +   '<span class="s-toast-title">Added to cart</span>'
            +   '<span class="s-toast-sub"></span>'
            + '</div>'
            + '<button class="s-toast-view" type="button">View</button>';
        document.body.appendChild(toast);
        toast.querySelector('.s-toast-view').addEventListener('click', () => {
            hideToast();
            openDrawer();
        });
        return toast;
    }

    function showToast(title, sub, isError) {
        const toast = ensureToast();
        toast.querySelector('.s-toast-title').textContent = title || 'Added to cart';
        toast.querySelector('.s-toast-sub').textContent = sub || '';
        toast.classList.toggle('is-error', !!isError);
        toast.classList.add('open');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(hideToast, 4000);
    }

    function hideToast() {
        const t = document.getElementById('s-toast');
        if (t) t.classList.remove('open');
    }

    // ============================================================
    // BIND ADD-TO-CART BUTTONS
    // ============================================================
    function bindAddButtons() {
        document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
            if (btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.addToCart;
                // Read qty from a paired qty-control on the same page
                const qtyEl = document.querySelector('.qty-value');
                const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
                const meta = Cart.add(id, qty);
                if (meta) showToast('Added to cart', meta.name);
            });
        });
    }

    function bindNavCartButton() {
        document.querySelectorAll('.cart-btn, .js-open-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openDrawer();
            });
        });
    }

    // ============================================================
    // EXISTING UX (scroll reveal, nav state, mobile menu, gallery, qty)
    // ============================================================
    function initScrollReveal() {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    entry.target.querySelectorAll('.divider').forEach(d => d.classList.add('active'));
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        document.querySelectorAll('.scroll-reveal').forEach(el => obs.observe(el));
    }

    function initNavState() {
        const nav = document.getElementById('siteNav');
        if (!nav) return;
        const set = () => nav.classList.toggle('solid', window.scrollY > 40);
        set();
        window.addEventListener('scroll', set, { passive: true });
    }

    function initMobileMenu() {
        const menuBtn = document.getElementById('menuBtn');
        const navLinks = document.getElementById('navLinks');
        if (!menuBtn || !navLinks) return;
        menuBtn.addEventListener('click', () => {
            const open = navLinks.classList.toggle('open');
            menuBtn.textContent = open ? 'Close' : 'Menu';
        });
        navLinks.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                navLinks.classList.remove('open');
                menuBtn.textContent = 'Menu';
            });
        });
    }

    function initGallery() {
        const mainImg = document.querySelector('.product-gallery .main-img img');
        const thumbs = document.querySelectorAll('.product-gallery .thumb');
        if (!mainImg || !thumbs.length) return;
        thumbs.forEach(t => {
            t.addEventListener('click', () => {
                thumbs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                const newSrc = t.querySelector('img').src;
                mainImg.style.opacity = '0';
                setTimeout(() => {
                    mainImg.src = newSrc;
                    mainImg.style.opacity = '1';
                }, 250);
            });
        });
    }

    function initQty() {
        const qty = document.querySelector('.qty-control');
        if (!qty) return;
        const valEl = qty.querySelector('.qty-value');
        const minus = qty.querySelector('[data-qty="minus"]');
        const plus = qty.querySelector('[data-qty="plus"]');
        const set = (n) => { valEl.textContent = Math.max(1, Math.min(10, n)); };
        minus.addEventListener('click', () => set(parseInt(valEl.textContent, 10) - 1));
        plus.addEventListener('click', () => set(parseInt(valEl.textContent, 10) + 1));
    }

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', () => {
        initScrollReveal();
        initNavState();
        initMobileMenu();
        initGallery();
        initQty();
        ensureDrawer();
        bindAddButtons();
        bindNavCartButton();
        updateCounters();

        // Re-bind any add buttons added later (defensive)
        const moBody = new MutationObserver(() => bindAddButtons());
        moBody.observe(document.body, { childList: true, subtree: true });
    });

    document.addEventListener('cart:updated', () => {
        updateCounters();
        bumpCounter();
        renderDrawer();
    });
})();
