/* ─────────────────────────────────────────────────────────────────────────
   smooth.js — "whoosh" scrolling
   Eased/smoothed scroll (Lenis) + velocity-driven motion blur on the
   foreground sections. The fixed cinematic video stays crisp behind them,
   so content streaks past while the film holds sharp.

   • Integrates with GSAP so the pinned intro scrub + frame scrub stay in sync.
   • Blur rises fast on a flick, settles smooth — never during the intro reveal.
   • Touch scroll stays native (no mobile nausea); reduced-motion → plain scroll.

   ── Tuning knobs (safe to tweak) ──────────────────────────────────────────
   GLIDE      lower = longer, floatier glide  (0.06 floaty ↔ 0.14 tight)
   MAX_BLUR   peak blur in px on a hard flick
   V_FOR_MAX  scroll velocity (px/frame) that reaches MAX_BLUR
   ───────────────────────────────────────────────────────────────────────── */
(function () {
    const GLIDE = 0.09;
    const MAX_BLUR = 6.5;
    const V_FOR_MAX = 42;

    const html = document.documentElement;
    const prefersReduced =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // No smooth-scroll lib or user prefers reduced motion → leave native scroll
    // untouched. The site behaves exactly as before.
    if (prefersReduced || !window.Lenis) return;

    const lenis = new Lenis({
        lerp: GLIDE,                 // frame-rate-independent glide
        wheelMultiplier: 1.0,
        smoothWheel: true,
        syncTouch: false,            // native momentum on phones — feels right, no jank
        touchMultiplier: 1.5,
    });
    window.__lenis = lenis;

    // ── Keep GSAP + ScrollTrigger driving off the *smoothed* scroll position ──
    if (window.gsap) {
        if (window.ScrollTrigger) {
            lenis.on('scroll', window.ScrollTrigger.update);
        }
        window.gsap.ticker.add((time) => lenis.raf(time * 1000)); // Lenis wants ms
        window.gsap.ticker.lagSmoothing(0);
    } else {
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
    }

    // ── Pause the glide while an overlay owns the screen ──────────────────────
    // Nav drawer → body.nav-open ; cart drawer → body.no-scroll
    const syncOverlay = () => {
        const blocked =
            document.body.classList.contains('nav-open') ||
            document.body.classList.contains('no-scroll');
        if (blocked) lenis.stop(); else lenis.start();
    };
    new MutationObserver(syncOverlay).observe(document.body, {
        attributes: true, attributeFilter: ['class'],
    });

    // ── Where does the intro runway end? Blur stays off until we're past it, so
    //    the letter-by-letter reveal + video-open stay clean. ─────────────────
    let introEnd = 0;
    const measure = () => {
        const intro = document.getElementById('intro');
        introEnd = intro ? intro.offsetTop + intro.offsetHeight - window.innerHeight : 0;
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    // ── Velocity → motion blur ────────────────────────────────────────────────
    let shown = 0;          // eased blur actually on screen
    let whooshing = false;

    const tickBlur = () => {
        const v = Math.abs(lenis.velocity || 0);
        const pastIntro = window.scrollY > introEnd + 4;
        const target = pastIntro ? Math.min(v / V_FOR_MAX, 1) * MAX_BLUR : 0;

        // rise quickly on a flick, fall away smoothly as it settles
        shown += (target - shown) * (target > shown ? 0.35 : 0.16);
        if (shown < 0.06) shown = 0;

        html.style.setProperty('--wb', shown.toFixed(2) + 'px');

        const on = shown > 0.12;
        if (on !== whooshing) {
            whooshing = on;
            html.classList.toggle('whooshing', on);
        }
    };

    if (window.gsap) window.gsap.ticker.add(tickBlur);
    else {
        const loop = () => { tickBlur(); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
    }

    // ── In-page anchor links glide instead of hard-jumping ────────────────────
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        let url;
        try { url = new URL(a.href, location.href); } catch (_) { return; }
        if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
        const target = document.querySelector(url.hash);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 1.15 });
        if (history.replaceState) history.replaceState(null, '', url.hash);
    });
})();
