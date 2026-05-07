// ============================================================================
// scene.jsx — Act I: The Certificates
//
// Adapted from dc-animation/project/scene.jsx with these changes from the
// design package's final state and from this project's iteration:
//   - Hero (i=0) uses the full-resolution Joyner JPEG instead of a downscaled
//     PNG. All other cards still use the small PNGs.
//   - The cert-phase OverlayText copy is rewritten to set up Act II's map
//     (Baltimore origin), since the original "127 boys" headline now plays
//     during the soil burial.
//   - SoilHeadline added: centered on the rising soil during the burial
//     phase, carrying the full "127 boys" statement.
//   - Drop shadow on cards removed (per the user's last design feedback).
//   - Bounce-on-landing removed — paper doesn't bounce.
// ============================================================================

const HERO_FILE = "certificates/01-joyner-clifton-hires.jpeg";

function useEmbeddedCerts() {
  const [d] = React.useState(() => window.__EMBEDDED_CERTS || []);
  return d;
}
function useEmbeddedEarth() {
  const [d] = React.useState(() => window.__EMBEDDED_EARTH || []);
  return d;
}

// Deterministic RNG so layout is identical every load.
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Per-card descriptor — landing position, drop trajectory, scale, rotation.
function makeCard({ i, n, pattern, W, H, srcCount, prePiled, prePiledIndex, prePiledTotal }) {
  const r = mulberry32((i + (prePiled ? 9001 : 0)) * 1331 + 7);
  const isHero = !prePiled && i === 0;

  let lx, ly, rot, scale;

  if (prePiled) {
    const cols = Math.ceil(prePiledTotal / 2);
    const col = prePiledIndex % cols;
    const row = Math.floor(prePiledIndex / cols);
    const cellW = W / cols;
    lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.6;
    ly = row === 0 ? H + 40 + (r() - 0.5) * 60 : H * 0.86 + (r() - 0.5) * 60;
    rot = (r() - 0.5) * 0.5;
    scale = 0.95 + r() * 0.30;
    return {
      i: -1 - prePiledIndex, isHero: false, prePiled: true,
      lx, ly, rot, scale,
      dropFromY: ly, dropFromXOffset: 0, dropFromRot: rot,
      srcIndex: Math.floor(r() * srcCount * 7) % srcCount,
      fallDur: 0.0001,
    };
  }

  if (pattern === 'pile') {
    const cx = W / 2, cy = H * 0.55;
    const radius = Math.min(W, H) * 0.32;
    const angle = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.6) * radius;
    lx = cx + Math.cos(angle) * rad;
    ly = cy + Math.sin(angle) * rad * 0.85;
    rot = (r() - 0.5) * 0.55;
    scale = 0.95 + r() * 0.25;
  } else if (pattern === 'grid') {
    const cols = Math.ceil(Math.sqrt(n * (W / H)));
    const rows = Math.ceil(n / cols);
    const cellW = W / cols, cellH = H / rows;
    const col = i % cols, row = Math.floor(i / cols);
    lx = col * cellW + cellW / 2;
    ly = row * cellH + cellH / 2;
    rot = (r() - 0.5) * 0.04;
    scale = Math.min(cellW / 480, cellH / 380) * 1.4;
  } else { // 'scatter' — design default
    const cols = Math.ceil(Math.sqrt(n * (W / H)));
    const rows = Math.ceil(n / cols);
    const col = i % cols, row = Math.floor(i / cols);
    const cellW = W / cols, cellH = H / rows;
    lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.85;
    ly = row * cellH + cellH / 2 + (r() - 0.5) * cellH * 0.85;
    rot = (r() - 0.5) * 0.45;
    scale = 0.85 + r() * 0.30;
  }

  if (isHero) {
    lx = W * 0.5; ly = H * 0.5; rot = 0; scale = 1.6;
  }

  const dropFromY = -H * (0.4 + r() * 0.3);
  const dropFromXOffset = (r() - 0.5) * W * 0.15;
  const dropFromRot = rot - (r() - 0.5) * 0.6 - 0.3;
  const srcIndex = isHero ? 0 : (Math.floor(r() * srcCount * 7) % srcCount);

  return {
    i, isHero,
    lx, ly, rot, scale,
    dropFromY, dropFromXOffset, dropFromRot,
    srcIndex,
    fallDur: isHero ? 1.4 : 0.55 + r() * 0.25,
  };
}

function arrivalTime(i, n, heroLand, accumStart, accumEnd) {
  if (i === 0) return 0;
  const span = accumEnd - accumStart;
  const u = (i - 1) / Math.max(1, n - 2);
  const eased = u * u;
  return accumStart + span * eased;
}

// ── Single certificate ──────────────────────────────────────────────────────
function Certificate({ src, card, time, recedeProgress, scrollY }) {
  const arrival = card.arrival;
  if (time < arrival) return null;

  const fT = clamp((time - arrival) / card.fallDur, 0, 1);
  const fE = Easing.easeInQuad(fT);

  const x = card.lx + card.dropFromXOffset * (1 - fE);
  let y = card.dropFromY + (card.ly - card.dropFromY) * fE;
  const rot = card.dropFromRot + (card.rot - card.dropFromRot) * fE;

  // Motion blur on high-velocity portion of fall (cheap directional approx)
  const fallVel = fT < 1 ? Math.max(0, 1 - Math.abs(fT - 0.6) * 2) : 0;
  const blur = fallVel * 6;

  // Parallax scroll-up
  y -= scrollY;

  // Recession during burial
  const sat = 1 - recedeProgress * 0.4;
  const bright = 1 - recedeProgress * 0.15;

  // 600×600 design box; objectFit: contain renders the actual scan at its
  // own aspect inside, so the visible card matches the source proportions.
  const baseW = 600, baseH = 600;

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width: baseW, height: baseH,
      marginLeft: -baseW / 2, marginTop: -baseH / 2,
      transform: `rotate(${rot}rad) scale(${card.scale})`,
      transformOrigin: 'center',
      filter: `blur(${blur}px) saturate(${sat}) brightness(${bright})`,
      willChange: 'transform, filter',
      zIndex: card.i,
      // No drop shadow — paper, not a postcard.
    }}>
      <img src={src}
           draggable={false}
           style={{
             width: '100%', height: '100%',
             objectFit: 'contain',
             display: 'block',
             userSelect: 'none', pointerEvents: 'none',
             filter: 'sepia(0.18) contrast(1.05)',
           }} />
    </div>
  );
}

// ── Cert-phase overlay text — Baltimore origin (sets up Act II) ─────────────
// Sits at zIndex -1 so the incoming pile physically obscures it.
// EDIT THIS COPY in scene.jsx · OverlayText.
function OverlayText({ time, opacity }) {
  if (opacity <= 0.01) return null;
  return (
    <div style={{
      position: 'absolute',
      left: '8%', right: '8%',
      bottom: '12%',
      opacity,
      transition: 'opacity 0.4s',
      pointerEvents: 'none',
      zIndex: -1,
    }}>
      <div style={{
        fontFamily: '"EB Garamond", Garamond, "Times New Roman", serif',
        fontWeight: 600,
        fontSize: 60,
        color: 'rgba(232, 220, 188, 0.95)',
        letterSpacing: '-0.005em',
        marginBottom: 18,
        lineHeight: 1.1,
      }}>
        Most came from Baltimore
      </div>
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 400,
        fontSize: 22,
        color: 'rgba(220, 210, 195, 0.85)',
        lineHeight: 1.5,
        maxWidth: 880,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      }}>
        An estimated 230 Black boys died in state custody at Cheltenham.
        Most were sent from a single city, thirty miles south to a
        state reformatory.
      </div>
    </div>
  );
}

// NOTE: The soil burial layer and the soil-centered headline are NOT rendered
// inside this React scene. They live outside Act I as page-scroll-driven
// elements (see #soil-burial and #soil-headline in index.html, driven by
// burial.js) so the soil can extend below this section's sticky pin and use
// its bottom transparent edge to reveal the map underneath.

// ── Counter ─────────────────────────────────────────────────────────────────
function Counter({ visible, opacity, scrollY }) {
  if (opacity <= 0.01) return null;
  return (
    <div style={{
      position: 'absolute',
      right: 60, bottom: 60 + scrollY * 0.3,
      color: 'rgba(220, 200, 170, 0.85)',
      textAlign: 'right',
      opacity,
      transition: 'opacity 0.3s',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      zIndex: 999,
    }}>
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 13,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'rgba(180, 150, 110, 0.7)',
        marginBottom: 6,
      }}>boys recorded dead</div>
      <div style={{
        fontFamily: '"EB Garamond", Garamond, "Times New Roman", serif',
        fontSize: 96,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        lineHeight: 1,
        color: 'rgba(232, 220, 188, 0.95)',
      }}>{visible}</div>
    </div>
  );
}

// ── Main scene ──────────────────────────────────────────────────────────────
function CertificatesScene({ tweaks }) {
  const rawTime = useTime();
  const { duration } = useTimeline();
  const certs = useEmbeddedCerts();
  const earth = useEmbeddedEarth();

  const W = 1920, H = 1080;
  const fps = tweaks.fps || 16;
  const time = tweaks.stopMotion
    ? Math.floor(rawTime * fps) / fps
    : rawTime;

  const total = Math.min(tweaks.peakCount, 40);

  if (!certs || certs.length === 0) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(220, 200, 170, 0.5)',
        fontFamily: '"Times New Roman", serif', fontSize: 18,
      }}>Loading certificates…</div>
    );
  }

  // Phase boundaries (proportional to duration)
  const heroEnd = duration * 0.18;
  const accumStart = heroEnd;
  const accumEnd = duration * 0.70;
  const holdEnd = duration * 0.84;
  const recedeStart = holdEnd;
  const recedeDur = duration - recedeStart;

  // Cert layer parallax scroll-up still happens inside the React scene —
  // this is the slow drift of the pile before/while burial begins.
  const scrollStart = duration * 0.62;
  const scrollEndCertificates = duration;
  const certScrollProgress = clamp((time - scrollStart) / (scrollEndCertificates - scrollStart), 0, 1);
  const certScrollEased = Easing.easeInOutCubic(certScrollProgress);
  const certScrollY = certScrollEased * H * 0.45;

  // Recession factor — used to desaturate cards during the burial. Driven by
  // the same time variable; the visible burial itself happens outside React.
  const recT = clamp((time - recedeStart) / recedeDur, 0, 1);

  // Cert-phase overlay text fade in/out (Baltimore-origin headline, during
  // the hero hold + accumulation flurry; obscured by the incoming pile)
  const overlayInStart = 1.4;
  const overlayInEnd = 2.4;
  const overlayOutStart = duration * 0.30;
  const overlayOutEnd = duration * 0.45;
  let overlayOpacity = 0;
  if (time >= overlayInStart && time <= overlayInEnd) {
    overlayOpacity = (time - overlayInStart) / (overlayInEnd - overlayInStart);
  } else if (time > overlayInEnd && time < overlayOutStart) {
    overlayOpacity = 1;
  } else if (time >= overlayOutStart && time <= overlayOutEnd) {
    overlayOpacity = 1 - (time - overlayOutStart) / (overlayOutEnd - overlayOutStart);
  }

  // Card descriptors (memoized)
  const PRE_PILED_COUNT = 14;
  const cards = React.useMemo(() => {
    const out = [];
    for (let k = 0; k < PRE_PILED_COUNT; k++) {
      const card = makeCard({
        i: k, n: PRE_PILED_COUNT, pattern: tweaks.pattern, W, H, srcCount: certs.length,
        prePiled: true, prePiledIndex: k, prePiledTotal: PRE_PILED_COUNT,
      });
      card.arrival = 0;
      out.push(card);
    }
    for (let i = 0; i < total; i++) {
      const card = makeCard({ i, n: total, pattern: tweaks.pattern, W, H, srcCount: certs.length });
      card.arrival = arrivalTime(i, total, heroEnd, accumStart, accumEnd);
      out.push(card);
    }
    return out;
  }, [total, tweaks.pattern, certs.length, heroEnd, accumStart, accumEnd]);

  const visibleCount = cards.filter(c => time >= c.arrival).length;
  const counterOpacity = Math.max(0, 1 - recT * 1.5);

  return (
    <>
      {/* Floor — soil texture (warm middle band) */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#1a0e07',
        backgroundImage: earth && earth[0] ? `url("${earth[0]}")` : 'none',
        backgroundSize: '110% 240%',
        backgroundPosition: 'center 35%',
        backgroundRepeat: 'no-repeat',
      }}/>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
      }}/>

      {/* Cert-phase overlay text (Baltimore origin) — beneath the pile */}
      <OverlayText time={time} opacity={overlayOpacity} />

      {/* All falling certificates. Hero (i=0) uses the hi-res file. */}
      {cards.map(card => (
        <Certificate
          key={card.i}
          card={card}
          src={card.isHero ? HERO_FILE : certs[card.srcIndex]}
          time={time}
          recedeProgress={recT}
          scrollY={certScrollY}
        />
      ))}

      {/* Counter */}
      {tweaks.showCounter && (
        <Counter
          visible={visibleCount}
          opacity={counterOpacity}
          scrollY={certScrollY}
        />
      )}
    </>
  );
}

window.CertificatesScene = CertificatesScene;
