// ============================================================================
// Act I — The Certificates
//
// Scroll-driven port of the Claude Design "dc-animation" package.
// Mental model: camera looking down at a soil-textured floor. Certificates
// fall from above the frame, accumulate, then a soil layer rises and buries
// them before handing off to Act II (the existing Mapbox scrollytelling).
//
// Timing is "virtual" — a 22-second timeline scaled across the section's
// scroll length. Stop-motion at 16 fps quantizes the whole sequence.
// ============================================================================

(function () {
  // ── Constants ────────────────────────────────────────────────────────────
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const BASE_W = 660;   // matches actual scan aspect (~1.65:1, source is 480x291)
  const BASE_H = 400;
  const PEAK_COUNT = 36;
  const PRE_PILED_COUNT = 14;
  const FPS = 16;
  const DURATION = 22; // virtual seconds — phase boundaries scaled from this

  const CERT_FILES = [
    "certificates/00-brown-samuel.png",
    "certificates/01-joyner-clifton.png",
    "certificates/02-carr-herman.png",
    "certificates/03-dickerson-ira.png",
    "certificates/04-dennis-irvin.png",
    "certificates/05-tyler-james.png",
    "certificates/06-king-john-henry.png",
    "certificates/07-russell-coley.png",
    "certificates/08-white-matthew.png",
    "certificates/09-martin-mitchell.png",
  ];

  // ── Math helpers ─────────────────────────────────────────────────────────
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const easeInQuad     = (t) => t * t;
  const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Deterministic RNG so card layout is identical every load.
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Card descriptor ──────────────────────────────────────────────────────
  function makeCard({ i, n, W, H, srcCount, prePiled, prePiledIndex, prePiledTotal }) {
    const r = mulberry32((i + (prePiled ? 9001 : 0)) * 1331 + 7);
    const isHero = !prePiled && i === 0;

    let lx, ly, rot, scale;

    if (prePiled) {
      // Two staggered rows across the bottom edge — fillers so the soil
      // backdrop never shows below the lowest scattered card.
      const cols = Math.ceil(prePiledTotal / 2);
      const col = prePiledIndex % cols;
      const row = Math.floor(prePiledIndex / cols);
      const cellW = W / cols;
      lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.6;
      ly = row === 0 ? H + 40 + (r() - 0.5) * 60 : H * 0.86 + (r() - 0.5) * 60;
      rot = (r() - 0.5) * 0.5;
      scale = 0.95 + r() * 0.30;
      return {
        i: -1 - prePiledIndex,
        isHero: false,
        prePiled: true,
        lx, ly, rot, scale,
        dropFromY: ly,
        dropFromXOffset: 0,
        dropFromRot: rot,
        srcIndex: Math.floor(r() * srcCount * 7) % srcCount,
        fallDur: 0.0001,
      };
    }

    // Scatter pattern (matches the design's default and final choice).
    const cols = Math.ceil(Math.sqrt(n * (W / H)));
    const rows = Math.ceil(n / cols);
    const col = i % cols, row = Math.floor(i / cols);
    const cellW = W / cols, cellH = H / rows;
    lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.85;
    ly = row * cellH + cellH / 2 + (r() - 0.5) * cellH * 0.85;
    rot = (r() - 0.5) * 0.45;
    scale = 0.85 + r() * 0.30;

    // Hero (i=0) lands center-frame, no rotation, larger scale.
    if (isHero) {
      lx = W * 0.5;
      ly = H * 0.5;
      rot = 0;
      scale = 1.6;
    }

    const dropFromY = -H * (0.4 + r() * 0.3);
    const dropFromXOffset = (r() - 0.5) * W * 0.15;
    const dropFromRot = rot - (r() - 0.5) * 0.6 - 0.3;
    const srcIndex = isHero ? 0 : Math.floor(r() * srcCount * 7) % srcCount;

    return {
      i,
      isHero,
      lx, ly, rot, scale,
      dropFromY,
      dropFromXOffset,
      dropFromRot,
      srcIndex,
      fallDur: isHero ? 1.4 : 0.55 + r() * 0.25, // hero falls slow
    };
  }

  // Cards arrive on a curve: hero first, long pause, then accelerating flurry.
  function arrivalTime(i, n, accumStart, accumEnd) {
    if (i === 0) return 0;
    const span = accumEnd - accumStart;
    const u = (i - 1) / Math.max(1, n - 2);
    const eased = u * u; // quadratic ease-in
    return accumStart + span * eased;
  }

  function buildCards() {
    const cards = [];
    const heroEnd = DURATION * 0.18;
    const accumStart = heroEnd;
    const accumEnd = DURATION * 0.70;

    for (let k = 0; k < PRE_PILED_COUNT; k++) {
      const card = makeCard({
        i: k, n: PRE_PILED_COUNT, W: STAGE_W, H: STAGE_H,
        srcCount: CERT_FILES.length,
        prePiled: true, prePiledIndex: k, prePiledTotal: PRE_PILED_COUNT,
      });
      card.arrival = 0;
      cards.push(card);
    }
    for (let i = 0; i < PEAK_COUNT; i++) {
      const card = makeCard({
        i, n: PEAK_COUNT, W: STAGE_W, H: STAGE_H,
        srcCount: CERT_FILES.length,
      });
      card.arrival = arrivalTime(i, PEAK_COUNT, accumStart, accumEnd);
      cards.push(card);
    }
    return cards;
  }

  // ── DOM state ────────────────────────────────────────────────────────────
  let cards = [];
  let cardEls = [];
  let sectionEl, stageEl, overlayTextEl, cardLayerEl, earthEl, counterWrapEl, counterNumEl;
  let lastTime = -1;

  function setup() {
    sectionEl = document.getElementById("act-i");
    stageEl = document.getElementById("act-i-stage");
    overlayTextEl = document.getElementById("act-i-overlay-text");
    cardLayerEl = document.getElementById("act-i-cards");
    earthEl = document.getElementById("act-i-earth");
    counterWrapEl = document.getElementById("act-i-counter");
    counterNumEl = document.getElementById("act-i-counter-num");

    if (!sectionEl || !stageEl || !cardLayerEl) return false;

    cards = buildCards();

    const frag = document.createDocumentFragment();
    for (let idx = 0; idx < cards.length; idx++) {
      const card = cards[idx];
      const wrap = document.createElement("div");
      wrap.className = "cert";
      wrap.style.zIndex = String(card.i); // pre-piled negative, hero 0, falling 1..n
      wrap.style.display = card.prePiled ? "" : "none";

      const img = document.createElement("img");
      img.src = CERT_FILES[card.srcIndex];
      img.draggable = false;
      img.alt = "";
      wrap.appendChild(img);

      cardEls.push(wrap);
      frag.appendChild(wrap);
    }
    cardLayerEl.appendChild(frag);
    return true;
  }

  // ── Per-frame update ─────────────────────────────────────────────────────
  function update(progress) {
    const rawT = progress * DURATION;
    // Stop-motion frame quantization — whole timeline steps in 16 fps ticks.
    const time = Math.floor(rawT * FPS) / FPS;
    if (time === lastTime) return;
    lastTime = time;

    // Phase boundaries (proportional to DURATION)
    const recedeStart = DURATION * 0.84;
    const recedeDur = DURATION - recedeStart;
    const scrollStart = DURATION * 0.62;
    const scrollEndCertificates = DURATION;

    // Certificate-layer parallax scroll-up
    const certScrollProgress = clamp(
      (time - scrollStart) / (scrollEndCertificates - scrollStart),
      0, 1
    );
    const certScrollY = easeInOutCubic(certScrollProgress) * STAGE_H * 0.45;

    // Earth burial scroll (faster than certificate scroll)
    const earthScrollProgress = clamp((time - recedeStart) / recedeDur, 0, 1);
    const earthScrollY = easeOutCubic(earthScrollProgress) * (STAGE_H + 600);

    // Recession: cards desaturate as earth rises
    const sat = 1 - earthScrollProgress * 0.4;
    const bright = 1 - earthScrollProgress * 0.15;

    // Overlay text fade in/out
    const overlayInStart = 1.4, overlayInEnd = 2.4;
    const overlayOutStart = DURATION * 0.30, overlayOutEnd = DURATION * 0.45;
    let overlayOpacity = 0;
    if (time >= overlayInStart && time <= overlayInEnd) {
      overlayOpacity = (time - overlayInStart) / (overlayInEnd - overlayInStart);
    } else if (time > overlayInEnd && time < overlayOutStart) {
      overlayOpacity = 1;
    } else if (time >= overlayOutStart && time <= overlayOutEnd) {
      overlayOpacity = 1 - (time - overlayOutStart) / (overlayOutEnd - overlayOutStart);
    }
    overlayTextEl.style.opacity = String(overlayOpacity);

    // Cards
    let visibleCount = 0;
    for (let idx = 0; idx < cards.length; idx++) {
      const card = cards[idx];
      const el = cardEls[idx];

      if (time < card.arrival) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      visibleCount++;
      if (el.style.display === "none") el.style.display = "";

      const fT = clamp((time - card.arrival) / card.fallDur, 0, 1);
      const fE = easeInQuad(fT); // accelerating fall

      const x = card.lx + card.dropFromXOffset * (1 - fE);
      let y = card.dropFromY + (card.ly - card.dropFromY) * fE;
      const rot = card.dropFromRot + (card.rot - card.dropFromRot) * fE;

      // Motion blur during high-velocity portion of the fall
      const fallVel = fT < 1 ? Math.max(0, 1 - Math.abs(fT - 0.6) * 2) : 0;
      const blur = fallVel * 6;

      // Parallax scroll-up — whole certificate layer drifts upward
      y -= certScrollY;

      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.transform = `rotate(${rot}rad) scale(${card.scale})`;
      el.style.filter = `blur(${blur}px) saturate(${sat}) brightness(${bright})`;
    }

    // Earth burial layer
    const earthY = STAGE_H + 40 - earthScrollY;
    earthEl.style.transform = `translateY(${earthY}px)`;

    // Counter
    if (counterNumEl) {
      counterNumEl.textContent = String(visibleCount);
      const counterOpacity = Math.max(0, 1 - earthScrollProgress * 1.5);
      counterWrapEl.style.opacity = String(counterOpacity);
    }
  }

  // ── Stage scaling ────────────────────────────────────────────────────────
  // Cover behavior: scale so the 1920×1080 stage fills the viewport,
  // overflowing on the longer axis (clipped by the pin's overflow:hidden).
  function updateScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.max(vw / STAGE_W, vh / STAGE_H);
    stageEl.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  // ── Scroll handler ───────────────────────────────────────────────────────
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const rect = sectionEl.getBoundingClientRect();
      const sectionH = sectionEl.offsetHeight;
      const vh = window.innerHeight;
      const scrollableDist = sectionH - vh;
      if (scrollableDist <= 0) {
        update(0);
        return;
      }
      const scrolled = -rect.top;
      const progress = clamp(scrolled / scrollableDist, 0, 1);
      update(progress);
    });
  }

  function init() {
    if (!setup()) return;
    updateScale();
    lastTime = -1;
    update(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      updateScale();
      lastTime = -1; // force re-render at new scale
      onScroll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
