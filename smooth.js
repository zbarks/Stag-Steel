/* ═══════════════════════════════════════════════════════════════════════════
   smooth.js — "LOCK SCROLL"
   ───────────────────────────────────────────────────────────────────────────
   The homepage cinematic panels (intro → stag/hero → material → place → making
   → mission) are a locked deck. Your scroll input does NOT free-scroll the page.
   Instead every push charges a spring: the section resists and nudges a little
   (and the stag turns a touch with it), and once you've pushed enough — a 2nd
   or 3rd notch, a firm trackpad flick, or a swipe — it WHOOSHES to the next
   section with motion blur. Pause mid-charge and it springs back. Universal
   across mouse wheel, MacBook trackpad, touch, and keyboard.

   Below the deck (shop / notes / footer) it releases into normal scrolling, and
   scrolling back up re-locks into the deck.

   ── Tuning knobs ──────────────────────────────────────────────────────────
   CHARGE_STEP   charge added per mouse "notch" (0.5 → whoosh on 2nd notch,
                 0.4 → ~3rd). Lower = more pushes needed.
   PEEK          how far the spring visibly nudges, as a fraction of screen.
   WHOOSH_MS     duration of the whoosh to the next section (ms).
   SWIPE_FULL    swipe distance for a full charge on touch (fraction of screen).
   MAX_BLUR      peak motion blur during a whoosh (px).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    const reduce =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isCinematic = !!(document.querySelector('.intro') && document.querySelector('#material'));

    if (reduce) return;                 // accessibility: leave native scroll alone
    if (isCinematic) lockScroll();
    else contentSmooth();

    /* ───────────────────────────── LOCK SCROLL ──────────────────────────── */
    function lockScroll() {
        const html = document.documentElement;

        // Tunables
        const CHARGE_STEP = 0.46;   // per mouse notch
        const NOTCH = 120;          // px that counts as one notch
        const EVENT_CAP = 1.4;      // max notch-units credited to one wheel event
        const PEEK = 0.07;          // spring nudge, fraction of viewport
        const WHOOSH_MS = 760;
        const SWIPE_FULL = 0.24;    // touch swipe fraction for full charge
        const IDLE_MS = 120;        // no-input time before the spring recoils
        const DECAY = 0.82;         // recoil speed
        const MAX_BLUR = 7.5;
        const BLUR_SPEED_FULL = 95; // px/frame that maps to full blur

        const vh = () => window.innerHeight;
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

        // Start every visit at the top (the intro title), not a restored scroll.
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

        let panels = [], bandStart = Infinity;
        function build() {
            const sel = ['.intro', '.vhero', '#material', '#place', '#making', '#mission'];
            panels = sel.map((s) => document.querySelector(s)).filter(Boolean)
                .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
            const band = document.querySelector('#shop-preview');
            bandStart = band ? Math.round(band.getBoundingClientRect().top + window.scrollY) : Infinity;
        }
        build();
        const rebuild = () => { build(); if (mode === 'locked' && !animating) settle(); };
        window.addEventListener('resize', rebuild);
        window.addEventListener('load', rebuild);

        let index = 0;          // current panel
        let mode = 'locked';    // 'locked' | 'free'
        let charge = 0;         // signed spring charge, [-1, 1]
        let dir = 0;            // charge direction
        let animating = false;
        let lastInput = 0;
        let cooldownUntil = 0;  // ignore input briefly after a whoosh (trackpad tails)

        const blocked = () =>
            document.body.classList.contains('nav-open') ||
            document.body.classList.contains('no-scroll');

        function setBlur(px) {
            html.style.setProperty('--wb', px.toFixed(2) + 'px');
            const on = px > 0.12;
            if (on !== html.classList.contains('whooshing')) html.classList.toggle('whooshing', on);
        }

        function settle() { window.scrollTo(0, panels[index] || 0); }

        function applyPeek() {
            if (animating) return;
            const base = panels[index] || 0;
            window.scrollTo(0, Math.round(base + charge * PEEK * vh()));
        }

        function whoosh(targetY, release) {
            animating = true;
            const from = window.scrollY;
            const t0 = performance.now();
            let prevY = from;
            (function step(now) {
                const p = Math.min(1, (now - t0) / WHOOSH_MS);
                const y = from + (targetY - from) * easeInOut(p);
                window.scrollTo(0, Math.round(y));
                const speed = Math.abs(y - prevY); prevY = y;
                setBlur(clamp(speed / BLUR_SPEED_FULL, 0, 1) * MAX_BLUR);
                if (p < 1) { requestAnimationFrame(step); return; }
                setBlur(0);
                animating = false; charge = 0; dir = 0;
                cooldownUntil = performance.now() + 280;
                if (release) mode = 'free';
            })(t0);
        }

        function fire(d) {
            if (d > 0) {
                if (index < panels.length - 1) { index++; whoosh(panels[index], false); }
                else whoosh(bandStart, true);           // leave the deck → content bands
            } else {
                if (index > 0) { index--; whoosh(panels[index], false); }
                else { charge = 0; applyPeek(); }        // already at the top
            }
        }

        function addCharge(amount) {
            if (animating) return;
            const d = Math.sign(amount);
            if (d !== dir) { charge = 0; dir = d; }      // reversed → reset the spring
            charge = clamp(charge + amount, -1, 1);
            lastInput = performance.now();
            if (charge >= 1) fire(1);
            else if (charge <= -1) fire(-1);
            else applyPeek();
        }

        // Spring recoil when input stops
        (function recoil() {
            if (!animating && mode === 'locked' && charge !== 0 &&
                performance.now() - lastInput > IDLE_MS) {
                charge *= DECAY;
                if (Math.abs(charge) < 0.004) charge = 0;
                applyPeek();
            }
            requestAnimationFrame(recoil);
        })();

        // ── WHEEL (mouse + trackpad) ──────────────────────────────────────────
        window.addEventListener('wheel', (e) => {
            if (blocked()) { if (!document.body.classList.contains('no-scroll')) e.preventDefault(); return; }
            if (mode === 'free') {
                if (window.scrollY <= bandStart - vh() * 0.4 && e.deltaY < 0) reLock();
                return;                                  // let the bands scroll natively
            }
            e.preventDefault();
            if (animating || performance.now() < cooldownUntil) { charge = 0; return; }
            let d = e.deltaY;
            if (e.deltaMode === 1) d *= 16;
            else if (e.deltaMode === 2) d *= vh();
            const units = clamp(d / NOTCH, -EVENT_CAP, EVENT_CAP);
            addCharge(units * CHARGE_STEP);
        }, { passive: false });

        // ── TOUCH ─────────────────────────────────────────────────────────────
        let startY = 0, touchDrag = false;
        window.addEventListener('touchstart', (e) => {
            if (blocked() || mode !== 'locked') return;
            startY = e.touches[0].clientY; touchDrag = true;
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (blocked()) return;
            if (mode === 'free') {
                if (window.scrollY <= bandStart - vh() * 0.4 && e.touches[0].clientY - startY > 0) reLock();
                return;
            }
            if (!touchDrag) return;
            e.preventDefault();
            if (animating) return;
            const moved = startY - e.touches[0].clientY;       // swipe up → advance
            const c = clamp(moved / (SWIPE_FULL * vh()), -1, 1);
            dir = Math.sign(c) || dir;
            charge = c;
            lastInput = performance.now();
            if (charge >= 1) { fire(1); touchDrag = false; }
            else if (charge <= -1) { fire(-1); touchDrag = false; }
            else applyPeek();
        }, { passive: false });
        window.addEventListener('touchend', () => { touchDrag = false; }, { passive: true });

        // ── KEYBOARD ──────────────────────────────────────────────────────────
        window.addEventListener('keydown', (e) => {
            if (mode !== 'locked' || animating || blocked()) return;
            if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); fire(1); }
            else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); fire(-1); }
        });

        function reLock() {
            mode = 'locked';
            index = panels.length - 1;   // mission
            charge = 0; dir = 0;
            whoosh(panels[index], false);
        }

        // In-page anchor links (nav / footer) whoosh to the right panel.
        document.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('a[href]');
            if (!a) return;
            let url; try { url = new URL(a.href, location.href); } catch (_) { return; }
            if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
            const target = document.querySelector(url.hash);
            if (!target) return;
            e.preventDefault();
            const y = Math.round(target.getBoundingClientRect().top + window.scrollY);
            // Nearest cinematic panel within a small tolerance → lock onto it.
            let pi = -1, best = 30;
            panels.forEach((py, i) => { const dd = Math.abs(py - y); if (dd < best) { best = dd; pi = i; } });
            if (pi !== -1) { mode = 'locked'; index = pi; charge = 0; dir = 0; whoosh(panels[pi], false); }
            else { mode = 'free'; window.scrollTo({ top: y, behavior: 'smooth' }); }
            if (history.replaceState) history.replaceState(null, '', url.hash);
        });
    }

    /* ─────────────────────── CONTENT PAGES (smooth glide) ───────────────────── */
    function contentSmooth() {
        if (!window.Lenis) return;
        const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
        window.__lenis = lenis;
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);

        const blocked = () =>
            document.body.classList.contains('nav-open') ||
            document.body.classList.contains('no-scroll');
        new MutationObserver(() => { blocked() ? lenis.stop() : lenis.start(); })
            .observe(document.body, { attributes: true, attributeFilter: ['class'] });

        document.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('a[href]');
            if (!a) return;
            let url; try { url = new URL(a.href, location.href); } catch (_) { return; }
            if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
            const target = document.querySelector(url.hash);
            if (!target) return;
            e.preventDefault();
            lenis.scrollTo(target, { offset: 0, duration: 1.05 });
            if (history.replaceState) history.replaceState(null, '', url.hash);
        });
    }
})();
