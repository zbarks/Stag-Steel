/* Cinematic intro
   1. Opens on a blank earthy-brown screen — no photo, no logo.
   2. "STAG AND STEEL / Crafted by hand" fades in, letter by letter, left to right.
   3. On scroll the title fades away and the video pops open from the centre,
      growing to full frame while the vignette and logo fade in. Then scrub.js
      takes over. Uses vendored GSAP + ScrollTrigger. */
(function () {
    const intro = document.getElementById('intro');
    const stage = document.querySelector('.scrub-stage');
    const scrim = document.querySelector('.scrub-scrim');
    const toggle = document.querySelector('.nav-toggle');
    const title = document.getElementById('introTitle');

    // Fallback: no GSAP → skip the intro, show the site normally.
    if (!window.gsap || !window.ScrollTrigger || !intro || !stage) {
        if (intro) intro.style.display = 'none';
        if (title) title.style.display = 'none';
        document.documentElement.classList.remove('intro-armed');
        document.body.classList.add('no-intro');
        return;
    }

    gsap.registerPlugin(ScrollTrigger);
    document.body.classList.add('has-intro');

    // Blank brown start: video clipped to nothing, vignette + logo hidden.
    gsap.set(stage, { '--cy': '50%', '--cx': '50%', '--cr': '12px' });
    if (scrim) gsap.set(scrim, { opacity: 0 });
    if (toggle) gsap.set(toggle, { opacity: 0 });
    gsap.set(title, { opacity: 1 });

    // Entrance: letters fade in left -> right, then the sub-line.
    gsap.from('.intro-brand .ch', {
        opacity: 0, yPercent: 45, stagger: 0.05,
        duration: 0.7, ease: 'power2.out', delay: 0.35,
    });
    gsap.from('.intro-sub', { opacity: 0, y: 12, duration: 0.9, ease: 'power2.out', delay: 1.1 });

    // Scroll: title fades/pops away, video grows from centre, vignette + logo in.
    const tl = gsap.timeline({
        scrollTrigger: { trigger: intro, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    });
    tl.to(title, { opacity: 0, scale: 1.12, yPercent: -24, ease: 'power2.in', duration: 0.30 }, 0.02)
      .to(stage, { '--cy': '0%', '--cx': '0%', '--cr': '0px', ease: 'power2.inOut', duration: 0.72 }, 0.16);
    if (scrim) tl.to(scrim, { opacity: 1, ease: 'none', duration: 0.5 }, 0.22);
    if (toggle) tl.to(toggle, { opacity: 1, ease: 'none', duration: 0.32 }, 0.62);

    // Reveal the hero line + Shop Now a touch earlier than the default in-view trigger.
    ['.vhero .hero-line', '.vhero .hero-cta-wrap'].forEach(function (sel) {
        const el = document.querySelector(sel);
        if (!el) return;
        ScrollTrigger.create({
            trigger: el,
            start: 'top 96%',
            onEnter: function () { el.classList.add('active'); },
        });
    });

    ScrollTrigger.refresh();
})();
