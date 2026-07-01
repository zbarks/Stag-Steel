/* Cinematic intro — the video's first frame grows from a centred card to
   full screen while the "STAG AND STEEL / Crafted by hand" title fades out.
   Once full-frame, scrub.js takes over. Uses vendored GSAP + ScrollTrigger. */
(function () {
    const intro = document.getElementById('intro');
    const stage = document.querySelector('.scrub-stage');
    const title = document.getElementById('introTitle');

    // Graceful fallback: if GSAP didn't load, skip the intro entirely.
    if (!window.gsap || !window.ScrollTrigger || !intro || !stage) {
        if (intro) intro.style.display = 'none';
        if (title) title.style.display = 'none';
        document.body.classList.add('no-intro');
        return;
    }

    gsap.registerPlugin(ScrollTrigger);
    document.body.classList.add('has-intro');

    // Start clipped to a small centred card.
    gsap.set(stage, { '--cy': '34%', '--cx': '32%', '--cr': '22px' });
    gsap.set(title, { opacity: 1, scale: 1 });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: intro,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1,
        },
    });

    // Title holds, then fades and lifts away.
    tl.to(title, { opacity: 0, scale: 1.1, ease: 'power2.in', duration: 0.42 }, 0.14);

    // The card grows to fill the screen.
    tl.to(stage, {
        '--cy': '0%', '--cx': '0%', '--cr': '0px',
        ease: 'power2.inOut', duration: 0.72,
    }, 0.10);

    ScrollTrigger.refresh();
})();
