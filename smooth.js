/* ─────────────────────────────────────────────────────────────────────────
   smooth.js — section "whoosh" scrolling
   -------------------------------------------------------------------------
   The cinematic panels (intro → hero → material → place → making → mission)
   behave like a deck: you settle on a panel, and a decisive scroll WHOOSHES
   you to the next one. A small scroll just nudges and springs back, so it
   feels "held" on the section. The solid content bands below (shop, notes,
   footer) scroll normally.

   • The stag frames are driven by scroll position, so they keep turning the
     whole time you scroll AND through every whoosh — never frozen.
   • Motion blur appears ONLY during a whoosh transition, not on every scroll.
   • Touch devices get plain native scroll (no snap / no blur) — feels right
     on a phone and avoids momentum fights.

   ── Tuning knobs ──────────────────────────────────────────────────────────
   GLIDE        free-scroll smoothing for the content bands (lower = floatier)
   WHOOSH_DUR   how long a section-to-section whoosh takes (seconds)
   THRESHOLD    how far you must scroll off a panel to advance (fraction of vh)
   MAX_BLUR     peak motion blur during a whoosh (px)
   ───────────────────────────────────────────────────────────────────────── */
(function () {
    const GLIDE = 0.10;
    const WHOOSH_DUR = 0.9;
    const THRESHOLD = 0.16;
    const IDLE_MS = 90;      // scroll-inactivity before deciding to snap
    const COOLDOWN_MS = 200; // rest after a whoosh before the next can fire
    const MAX_BLUR = 7.0;
    const V_FOR_MAX = 46;    // scroll velocity that maps to full blur

    const html = document.documentElement;
    const reduce =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Snap only for real pointers on a roomy screen; phones scroll natively.
    const enableSnap =
        window.matchMedia &&
        window.matchMedia('(pointer: fine)').matches &&
        window.innerWidth >= 800;

    if (reduce || !window.Lenis) return;   // graceful: native scroll, no effects

    const lenis = new Lenis({
        lerp: GLIDE,
        wheelMultiplier: 0.9,
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 1.5,
    });
    window.__lenis = lenis;

    // Keep GSAP + ScrollTrigger (pinned intro + frame scrub) on the smoothed scroll.
    if (window.gsap) {
        if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add((t) => lenis.raf(t * 1000));
        window.gsap.ticker.lagSmoothing(0);
    } else {
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
    }

    // Pause everything while the nav drawer or cart owns the screen.
    const blocked = () =>
        document.body.classList.contains('nav-open') ||
        document.body.classList.contains('no-scroll');
    new MutationObserver(() => { blocked() ? lenis.stop() : lenis.start(); })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const vh = () => window.innerHeight;

    // ── The cinematic panels, in order. Their tops are the snap positions. ────
    let panels = [];   // y offsets
    let exitY = Infinity;
    function build() {
        const sel = ['.intro', '.vhero', '#material', '#place', '#making', '#mission'];
        panels = sel
            .map((s) => document.querySelector(s))
            .filter(Boolean)
            .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
        const exit = document.querySelector('#shop-preview');
        exitY = exit ? Math.round(exit.getBoundingClientRect().top + window.scrollY) : Infinity;
    }

    // ── Snap state ────────────────────────────────────────────────────────────
    let settled = 0;         // index of the panel we're anchored to
    let snapping = false;    // a whoosh is in progress
    let cooldown = false;
    let idleTimer = 0;

    function nearestReset() {
        const y = window.scrollY;
        let best = Infinity;
        panels.forEach((py, i) => { const d = Math.abs(py - y); if (d < best) { best = d; settled = i; } });
    }

    build();
    nearestReset();
    window.addEventListener('load', () => { build(); nearestReset(); });
    window.addEventListener('resize', () => { build(); nearestReset(); });

    function inCinematicZone() {
        return panels.length && window.scrollY <= panels[panels.length - 1] + vh() * 0.5;
    }

    function whooshTo(i) {
        i = Math.max(0, Math.min(panels.length - 1, i));
        if (i === settled && Math.abs(window.scrollY - panels[i]) < 2) return; // already there
        snapping = true;
        lenis.scrollTo(panels[i], {
            duration: WHOOSH_DUR,
            easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // easeInOutCubic
            lock: true,               // a decisive, uninterruptible whoosh
            onComplete: () => {
                settled = i;
                snapping = false;
                cooldown = true;
                setTimeout(() => { cooldown = false; }, COOLDOWN_MS);
            },
        });
    }

    function decide() {
        if (!enableSnap || snapping || cooldown || blocked()) return;
        if (!inCinematicZone()) { nearestReset(); return; }
        if (Math.abs(lenis.velocity || 0) > 0.5) return;   // still gliding

        const delta = window.scrollY - panels[settled];
        const T = vh() * THRESHOLD;
        const last = panels.length - 1;

        if (delta > T) {
            if (settled < last) whooshTo(settled + 1);
            // at the final panel → let them fall through into the content bands
        } else if (delta < -T) {
            if (settled > 0) whooshTo(settled - 1);
        } else if (Math.abs(delta) > 2) {
            whooshTo(settled);   // small scroll → spring back (the "held" feel)
        }
    }

    // ── Motion blur — ONLY while a whoosh is running ──────────────────────────
    let shown = 0, whooshing = false;
    function tickBlur() {
        const target = snapping
            ? Math.min(Math.abs(lenis.velocity || 0) / V_FOR_MAX, 1) * MAX_BLUR
            : 0;
        shown += (target - shown) * (target > shown ? 0.4 : 0.2);
        if (shown < 0.06) shown = 0;
        html.style.setProperty('--wb', shown.toFixed(2) + 'px');
        const on = shown > 0.12;
        if (on !== whooshing) { whooshing = on; html.classList.toggle('whooshing', on); }
    }
    if (window.gsap) window.gsap.ticker.add(tickBlur);
    else { const loop = () => { tickBlur(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

    // Every scroll resets the idle timer; when scrolling stops we decide.
    lenis.on('scroll', () => {
        if (!enableSnap) return;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(decide, IDLE_MS);
    });

    // ── In-page anchor links glide to their section ───────────────────────────
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        let url; try { url = new URL(a.href, location.href); } catch (_) { return; }
        if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
        const target = document.querySelector(url.hash);
        if (!target) return;
        e.preventDefault();
        const y = Math.round(target.getBoundingClientRect().top + window.scrollY);
        snapping = true;
        lenis.scrollTo(y, {
            duration: 1.05, lock: true,
            onComplete: () => { snapping = false; nearestReset(); },
        });
        if (history.replaceState) history.replaceState(null, '', url.hash);
    });
})();
