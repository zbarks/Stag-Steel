/* Spinning-logo nav toggle → right-hand drawer. */
(function () {
    const btn = document.getElementById('navToggle');
    const drawer = document.getElementById('navDrawer');
    const backdrop = document.getElementById('navBackdrop');
    if (!btn || !drawer) return;

    let open = false;
    function set(o) {
        open = o;
        document.body.classList.toggle('nav-open', o);
        btn.setAttribute('aria-expanded', o ? 'true' : 'false');
        btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
        drawer.setAttribute('aria-hidden', o ? 'false' : 'true');
    }

    btn.addEventListener('click', () => set(!open));
    if (backdrop) backdrop.addEventListener('click', () => set(false));
    // Close after choosing a destination link (not the cart button).
    drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
    // Cart opens its own drawer — close the nav first.
    const cart = drawer.querySelector('.nd-cart');
    if (cart) cart.addEventListener('click', () => set(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
})();
