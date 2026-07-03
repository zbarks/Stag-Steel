/* Scroll-scrubbed video background.
   Frames live in assets/frames/f001.jpg … fNNN.jpg. As the page scrolls from
   the top down to where the footer begins, the canvas scrubs through them. */
(function () {
    const canvas = document.getElementById('scrubCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    // How much of the frame fills the stage. 1 = full-bleed cover (most zoomed /
    // softest on a big screen). Below 1 renders the stag a bit smaller — less
    // upscaling, so it holds its resolution — with the stage colour around it.
    const FRAME_FILL = 0.9;
    const STAGE_BG = '#221d1a';

    const FRAME_COUNT = 133;
    const pad = (n) => String(n).padStart(3, '0');
    const src = (i) => 'assets/frames/f' + pad(i) + '.jpg';

    const images = new Array(FRAME_COUNT);
    let firstReady = false;
    let curFrame = -1;
    let cw = 0, ch = 0;

    // Preload every frame (they're small). Draw frame 1 as soon as it lands.
    for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src(i);
        images[i - 1] = img;
        if (i === 1) {
            img.onload = () => { firstReady = true; resize(); };
        }
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cw = canvas.clientWidth;
        ch = canvas.clientHeight;
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        curFrame = -1;      // force redraw
        update(true);
    }

    function drawCover(img) {
        if (!img || !img.complete || !img.naturalWidth) return;
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = cw / ch;
        let dw, dh, dx, dy;
        if (cr > ir) { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
        else { dh = ch; dw = ch * ir; dy = 0; dx = (cw - dw) / 2; }
        if (FRAME_FILL !== 1) {
            // Shrink toward the centre so the stag isn't blown up as much.
            const nw = dw * FRAME_FILL, nh = dh * FRAME_FILL;
            dx += (dw - nw) / 2; dy += (dh - nh) / 2;
            dw = nw; dh = nh;
            ctx.fillStyle = STAGE_BG;
            ctx.fillRect(0, 0, cw, ch);
        }
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    function targetFrame() {
        const intro = document.getElementById('intro');
        // Begin spinning the moment the product first pops into view (~17% through
        // the intro, where the clip starts growing) rather than after the intro.
        const start = intro ? (intro.offsetTop + intro.offsetHeight * 0.17) : 0;
        const footer = document.querySelector('.site-footer');
        const end = (footer ? footer.offsetTop : document.body.scrollHeight) - window.innerHeight;
        const span = Math.max(1, end - start);
        const p = Math.min(1, Math.max(0, (window.scrollY - start) / span));
        return Math.round(p * (FRAME_COUNT - 1));
    }

    function update(force) {
        if (!firstReady) return;
        const f = targetFrame();
        if (f === curFrame && !force) return;
        curFrame = f;
        // Fall back to the nearest already-loaded frame if this one isn't in yet.
        let img = images[f];
        if (!img || !img.complete || !img.naturalWidth) {
            for (let d = 1; d < FRAME_COUNT; d++) {
                const a = images[f - d], b = images[f + d];
                if (a && a.complete && a.naturalWidth) { img = a; break; }
                if (b && b.complete && b.naturalWidth) { img = b; break; }
            }
        }
        drawCover(img);
    }

    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { update(false); ticking = false; });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    // In case some frames finish loading after the first paint.
    window.addEventListener('load', () => update(true));
    resize();
})();
