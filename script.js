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
                // animate child dividers if present
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

    // --- Cart dot indicator -------------------------------------
    // Listen to Snipcart count changes to highlight cart
    const cartBtn = document.querySelector('.cart-btn');
    const updateCartDot = () => {
        const countEl = document.querySelector('.snipcart-items-count');
        if (!cartBtn || !countEl) return;
        const count = parseInt(countEl.textContent, 10) || 0;
        cartBtn.dataset.hasItems = count > 0 ? 'true' : 'false';
    };
    // Watch for changes to count element
    const countEl = document.querySelector('.snipcart-items-count');
    if (countEl && cartBtn) {
        const mo = new MutationObserver(updateCartDot);
        mo.observe(countEl, { childList: true, characterData: true, subtree: true });
        updateCartDot();
    }

    // --- Quick add (shop page only) -----------------------------
    document.querySelectorAll('.quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Snipcart auto-detects via .snipcart-add-item class on this button
        });
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
                // fade transition
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
