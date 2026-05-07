/* ================================
   STAG & STEEL — Shared Scripts
   ================================ */

(function () {
    'use strict';

    // --- Scroll reveal observer ---------------------------------
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                entry.target.querySelectorAll('.divider').forEach(d => d.classList.add('active'));
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.scroll-reveal').forEach(el => revealObserver.observe(el));

    // --- Nav scroll state ---------------------------------------
    const nav = document.getElementById('siteNav');
    if (nav) {
        const setNavState = () => {
            if (window.scrollY > 40) nav.classList.add('solid');
            else nav.classList.remove('solid');
        };
        setNavState();
        window.addEventListener('scroll', setNavState, { passive: true });
    }

    // --- Mobile menu --------------------------------------------
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('open');
            menuBtn.textContent = isOpen ? 'Close' : 'Menu';
        });
        navLinks.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                navLinks.classList.remove('open');
                menuBtn.textContent = 'Menu';
            });
        });
    }

    // --- Cart count + dot indicator + nudge animation -----------
    const cartBtn = document.querySelector('.cart-btn');
    const updateCartUI = () => {
        const countEl = document.querySelector('.snipcart-items-count');
        if (!cartBtn || !countEl) return;
        const count = parseInt(countEl.textContent, 10) || 0;
        cartBtn.dataset.hasItems = count > 0 ? 'true' : 'false';
    };
    const cartCountEl = document.querySelector('.snipcart-items-count');
    if (cartCountEl && cartBtn) {
        const mo = new MutationObserver(() => {
            updateCartUI();
            cartBtn.classList.remove('cart-bump');
            void cartBtn.offsetWidth; // reflow to restart animation
            cartBtn.classList.add('cart-bump');
        });
        mo.observe(cartCountEl, { childList: true, characterData: true, subtree: true });
        updateCartUI();
    }

    // --- Toast notification -------------------------------------
    function ensureToast() {
        let toast = document.getElementById('s-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 's-toast';
            toast.className = 's-toast';
            toast.innerHTML = '' +
                '<span class="s-toast-tick">+</span>' +
                '<div class="s-toast-body">' +
                    '<span class="s-toast-title">Added to cart</span>' +
                    '<span class="s-toast-sub"></span>' +
                '</div>' +
                '<button class="s-toast-view" type="button">View</button>';
            document.body.appendChild(toast);

            toast.querySelector('.s-toast-view').addEventListener('click', () => {
                if (window.Snipcart) {
                    window.Snipcart.api.theme.cart.open();
                }
                hideToast();
            });
        }
        return toast;
    }

    function showToast(itemName) {
        const toast = ensureToast();
        toast.querySelector('.s-toast-sub').textContent = itemName || '';
        toast.classList.add('open');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(hideToast, 4000);
    }

    function hideToast() {
        const toast = document.getElementById('s-toast');
        if (toast) toast.classList.remove('open');
    }

    // --- Wait for Snipcart, then hook events --------------------
    document.addEventListener('snipcart.ready', () => {
        if (!window.Snipcart) return;

        // When an item is added, show our toast
        window.Snipcart.events.on('item.added', (item) => {
            showToast(item && item.name ? item.name : 'Item added');
        });

        updateCartUI();
    });

    // --- Pre-Snipcart click feedback ----------------------------
    // If Snipcart hasn't loaded yet, the click does nothing. Give visible
    // feedback so the click doesn't feel dead, then re-fire when ready.
    document.querySelectorAll('.snipcart-add-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!window.Snipcart) {
                btn.classList.add('is-loading');
                const restoreText = btn.textContent;
                btn.dataset._restore = restoreText;
                btn.textContent = 'Loading…';
                let tries = 0;
                const poll = setInterval(() => {
                    tries++;
                    if (window.Snipcart) {
                        clearInterval(poll);
                        btn.textContent = btn.dataset._restore || restoreText;
                        btn.classList.remove('is-loading');
                        btn.click();
                    } else if (tries > 30) {
                        clearInterval(poll);
                        btn.textContent = btn.dataset._restore || restoreText;
                        btn.classList.remove('is-loading');
                    }
                }, 300);
            }
        }, true);
    });

    // --- Product gallery (detail pages) -------------------------
    const mainImg = document.querySelector('.product-gallery .main-img img');
    const thumbs = document.querySelectorAll('.product-gallery .thumb');
    if (mainImg && thumbs.length) {
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

    // --- Quantity control ---------------------------------------
    const qtyControl = document.querySelector('.qty-control');
    if (qtyControl) {
        const valEl = qtyControl.querySelector('.qty-value');
        const minus = qtyControl.querySelector('[data-qty="minus"]');
        const plus = qtyControl.querySelector('[data-qty="plus"]');
        const addBtn = document.querySelector('.add-to-cart');
        const setQty = (n) => {
            const newVal = Math.max(1, Math.min(10, n));
            valEl.textContent = newVal;
            if (addBtn) addBtn.setAttribute('data-item-quantity', newVal);
        };
        minus.addEventListener('click', () => setQty(parseInt(valEl.textContent, 10) - 1));
        plus.addEventListener('click', () => setQty(parseInt(valEl.textContent, 10) + 1));
    }
})();
