// scene.jsx — Act I: The Certificates (v2)
// Mental model: camera looking down at a floor. Certificates fall in from
// off-screen, land with a small bounce, settle. After the field is full,
// everything begins scrolling upward (slow). Layered earth PNGs scroll
// faster on top, burying the record.
// Globals from animations.jsx: Stage, useTimeline, useTime, Easing, clamp

// ── Embedded data hookup ────────────────────────────────────────────────────
function useEmbeddedCerts() {
  const [d] = React.useState(() => window.__EMBEDDED_CERTS || []);
  return d;
}
function useEmbeddedEarth() {
  const [d] = React.useState(() => window.__EMBEDDED_EARTH || []);
  return d;
}

// ── Deterministic RNG ────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Per-card descriptor ─────────────────────────────────────────────────────
// Computes everything about a certificate up front, deterministic in `i`.
//   - landing position (where on the floor it ends up)
//   - drop-from offset (how far above the frame it starts)
//   - rotation, scale
//   - arrival time (when it begins falling)
//   - fall duration (how long the fall takes)
//
// Pattern controls landing layout. Stage size W×H is in the design space.
function makeCard({ i, n, pattern, W, H, srcCount, prePiled, prePiledIndex, prePiledTotal }) {
  const r = mulberry32((i + (prePiled ? 9001 : 0)) * 1331 + 7);
  const isHero = !prePiled && i === 0;

  // Landing position
  let lx, ly, rot, scale;

  if (prePiled) {
    // Strip across the bottom of the frame, two staggered rows.
    // Cards oversized to overlap heavily and never expose the soil backdrop.
    const cols = Math.ceil(prePiledTotal / 2);
    const col = prePiledIndex % cols;
    const row = Math.floor(prePiledIndex / cols); // 0 or 1
    const cellW = W / cols;
    lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.6;
    // Row 0 sits at the very bottom (half off-screen), row 1 just above.
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
    // Centered cluster — cards land near the middle, overlapping.
    const cx = W / 2, cy = H * 0.55;
    const radius = Math.min(W, H) * 0.32;
    const angle = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.6) * radius;
    lx = cx + Math.cos(angle) * rad;
    ly = cy + Math.sin(angle) * rad * 0.85;
    rot = (r() - 0.5) * 0.55; // ±~16°
    scale = 0.95 + r() * 0.25; // BIG — single card nearly fills frame
  } else if (pattern === 'grid') {
    const cols = Math.ceil(Math.sqrt(n * (W / H)));
    const rows = Math.ceil(n / cols);
    const cellW = W / cols, cellH = H / rows;
    const col = i % cols, row = Math.floor(i / cols);
    lx = col * cellW + cellW / 2;
    ly = row * cellH + cellH / 2;
    rot = (r() - 0.5) * 0.04;
    scale = Math.min(cellW / 480, cellH / 380) * 1.4;
  } else { // 'scatter' — stratified across full floor, oversized so they overlap heavily
    const cols = Math.ceil(Math.sqrt(n * (W / H)));
    const rows = Math.ceil(n / cols);
    const col = i % cols, row = Math.floor(i / cols);
    const cellW = W / cols, cellH = H / rows;
    lx = col * cellW + cellW / 2 + (r() - 0.5) * cellW * 0.85;
    ly = row * cellH + cellH / 2 + (r() - 0.5) * cellH * 0.85;
    rot = (r() - 0.5) * 0.45; // ±~13°
    scale = 0.85 + r() * 0.30; // BIG — heavy overlap, screen-overwhelming
  }

  // Hero override: lands center, large enough to nearly fill the frame.
  if (isHero) {
    lx = W * 0.5; ly = H * 0.5; rot = 0; scale = 1.6;
  }

  // Drop trajectory: cards fall from above the frame at varied X offsets
  // (so the eye sees them coming from different parts of the sky). The
  // fall is mostly vertical but with a small lateral drift.
  const dropFromY = -H * (0.4 + r() * 0.3); // start 40-70% above frame
  const dropFromXOffset = (r() - 0.5) * W * 0.15; // small horizontal start offset
  const dropFromRot = rot - (r() - 0.5) * 0.6 - 0.3; // tumbling during fall

  // Source image (cycle through unique scans, with shuffled mapping so
  // adjacent indices don't repeat the same image)
  const srcIndex = isHero ? 0 : (Math.floor(r() * srcCount * 7) % srcCount);

  return {
    i, isHero,
    lx, ly, rot, scale,
    dropFromY, dropFromXOffset, dropFromRot,
    srcIndex,
    fallDur: isHero ? 1.4 : 0.55 + r() * 0.25, // hero falls slow
  };
}

// Cards arrive on a curve: hero first, long pause, then accelerating
// flurry. accumStart..accumEnd is the window for non-hero arrivals.
function arrivalTime(i, n, heroLand, accumStart, accumEnd) {
  if (i === 0) return 0; // hero starts at t=0
  const span = accumEnd - accumStart;
  // i runs 1..n-1; bias arrivals so early ones are spaced wide
  const u = (i - 1) / Math.max(1, n - 2);
  // Quadratic ease-in: first few cards take their time, then it pours
  const eased = u * u;
  return accumStart + span * eased;
}

// ── Certificate sprite ──────────────────────────────────────────────────────
function Certificate({ src, card, time, recedeProgress, scrollY }) {
  const arrival = card.arrival;
  if (time < arrival) return null;

  // Fall progress 0..1
  const fT = clamp((time - arrival) / card.fallDur, 0, 1);
  const fE = Easing.easeInQuad(fT); // accelerating fall

  // Position interpolation: from drop-from to landing
  const x = card.lx + card.dropFromXOffset * (1 - fE);
  let y = card.dropFromY + (card.ly - card.dropFromY) * fE;

  // Rotation: tumbles during fall, settles to final rotation
  const rot = card.dropFromRot + (card.rot - card.dropFromRot) * fE;

  // Bounce at landing — a small overshoot then settle
  let bounceY = 0;
  let bounceScale = 1;
  if (fT >= 1) {
    const bounceT = clamp((time - arrival - card.fallDur) / 0.35, 0, 1);
    // Damped sine — quick settle
    const bE = Math.sin(bounceT * Math.PI * 2) * Math.exp(-bounceT * 4);
    bounceY = -bE * 18;
    bounceScale = 1 + bE * 0.025;
  }

  // Motion blur during fall — vertical streak. Real CSS motion blur is
  // expensive (filter: blur on a tall element) so we use a directional
  // box-shadow + slight Y-axis filter blur during the high-velocity portion.
  const fallVel = fT < 1 ? Math.max(0, 1 - Math.abs(fT - 0.6) * 2) : 0;
  const blur = fallVel * 6;

  // Scroll-up parallax (Phase 3+): all certificates drift upward with scroll.
  // scrollY here is the local "up" offset for the certificate layer.
  y -= scrollY;

  // Recession: during burial, certificates desaturate and dim slightly
  const sat = 1 - recedeProgress * 0.4;
  const bright = 1 - recedeProgress * 0.15;

  // Card dimensions in design space — sized to the source aspect (~1.05:1
  // for these scans). Render at a fixed base size, transform with scale.
  const baseW = 600, baseH = 600;

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y + bounceY,
      width: baseW, height: baseH,
      marginLeft: -baseW / 2, marginTop: -baseH / 2,
      transform: `rotate(${rot}rad) scale(${card.scale * bounceScale})`,
      transformOrigin: 'center',
      filter: `blur(${blur}px) saturate(${sat}) brightness(${bright})`,
      willChange: 'transform, filter',
      zIndex: card.i,
      // Heavy paper shadow — the sense that it landed on a surface
      filter_disabled: '',
      boxShadow: '0 12px 26px rgba(0,0,0,0.55), 0 3px 8px rgba(0,0,0,0.4)',
    }}>
      <img src={src}
           draggable={false}
           style={{
             width: '100%', height: '100%',
             objectFit: 'contain',
             display: 'block',
             userSelect: 'none', pointerEvents: 'none',
             // Slight warm filter to harmonize the off-white scans against the dark floor
             filter: 'sepia(0.18) contrast(1.05)',
           }} />
    </div>
  );
}

// ── Overlay text ─────────────────────────────────────────────────────────────
// Shows during the hero hold (t ~ 1.5s to 4.5s), then gets covered by
// incoming certificates as they accumulate. The text doesn't move — the
// documents physically obscure it.
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
      // sit above the hero card but below the incoming pile (zIndex 0 puts
      // it under all certificate sprites which start at zIndex 0..n)
      zIndex: -1,
    }}>
      <div style={{
        fontFamily: '"UnifrakturMaguntia", "Old English Text MT", serif',
        fontSize: 56,
        color: 'rgba(220, 200, 170, 0.9)',
        letterSpacing: '0.02em',
        textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        marginBottom: 18,
        lineHeight: 1.1,
      }}>
        One hundred and twenty-seven boys
      </div>
      <div style={{
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: 26,
        color: 'rgba(220, 210, 195, 0.78)',
        lineHeight: 1.45,
        maxWidth: 920,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        fontStyle: 'italic',
      }}>
        died in state custody at the Cheltenham House of Reformation
        between 1900 and 1950 — most of tuberculosis,
        most from Baltimore, all of them Black.
      </div>
      <div style={{
        marginTop: 16,
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: 14,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(180, 150, 110, 0.6)',
      }}>
        — Edit this overlay copy in scene.jsx · OverlayText —
      </div>
    </div>
  );
}

// ── Earth layers ─────────────────────────────────────────────────────────────
// User will provide 1–3 PNGs (full-frame, transparent above soil-line).
// They scroll up FASTER than the certificates, overtaking and burying.
// Stub fallback: gradient bands rising from bottom if no PNGs provided.
function EarthLayers({ scrollY, srcs, W, H }) {
  if (!srcs || srcs.length === 0) {
    // Procedural fallback — three soil bands rising from bottom as we scroll
    return (
      <>
        {[0, 1, 2].map(idx => {
          const speed = 1.6 + idx * 0.4; // back-most slowest, but all faster than 1×
          const baseColors = ['#1a0c05', '#2a1810', '#3a2415'];
          const heightFrac = 0.55 - idx * 0.12;
          // Initial position: layer is below the screen; scrollY pushes it up
          const layerY = H + 40 - scrollY * speed - idx * 30;
          return (
            <div key={idx} style={{
              position: 'absolute',
              left: -40, right: -40,
              top: layerY,
              height: H * heightFrac + 200,
              background: `linear-gradient(180deg, transparent 0%, ${baseColors[idx]} 12%, ${baseColors[idx]} 100%)`,
              pointerEvents: 'none',
              zIndex: 1000 + idx,
              filter: 'blur(' + (idx === 0 ? 1 : 0) + 'px)',
            }}/>
          );
        })}
      </>
    );
  }

  // Real PNG layers, ordered back-to-front. Each scrolls at increasing speed.
  return (
    <>
      {srcs.map((src, idx) => {
        const speed = 1.6 + idx * 0.45;
        const layerY = H + 40 - scrollY * speed - idx * 20;
        return (
          <img key={idx}
               src={src}
               draggable={false}
               style={{
                 position: 'absolute',
                 left: 0, top: layerY,
                 width: W, height: 'auto',
                 pointerEvents: 'none',
                 userSelect: 'none',
                 zIndex: 1000 + idx,
               }}/>
        );
      })}
    </>
  );
}

// ── Counter ─────────────────────────────────────────────────────────────────
function Counter({ visible, total, opacity, scrollY }) {
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
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: 14,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'rgba(180, 150, 110, 0.7)',
        marginBottom: 6,
      }}>boys recorded dead</div>
      <div style={{
        fontFamily: '"UnifrakturMaguntia", "Old English Text MT", serif',
        fontSize: 110,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 400,
        lineHeight: 1,
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

  // Stop-motion / VOX-style frame quantization: snap the WHOLE timeline to
  // discrete frame boundaries — falling, parallax scroll, and earth burial
  // all step together at the same cadence.
  const W = 1920, H = 1080;
  const fps = tweaks.fps || 16;
  const time = tweaks.stopMotion
    ? Math.floor(rawTime * fps) / fps
    : rawTime;

  const total = Math.min(tweaks.peakCount, 40); // cap at 40; repetition handled by srcIndex

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

  // Choreography phases (proportional to duration)
  // 0.00–0.18 : hero falls + holds, overlay text fades in
  // 0.18–0.70 : accumulation flurry
  // 0.70–0.84 : hold + scroll-up begins
  // 0.84–1.00 : earth layers sweep up and bury everything
  const heroEnd = duration * 0.18;
  const accumStart = heroEnd;
  const accumEnd = duration * 0.70;
  const holdEnd = duration * 0.84;
  const recedeStart = holdEnd;
  const recedeDur = duration - recedeStart;

  // Scroll-up offset: certificates start drifting up at scrollStart, accelerating
  // toward recedeStart. After recedeStart, scroll continues but slower than earth.
  const scrollStart = duration * 0.62; // begins partway through accumulation hold
  const scrollEndCertificates = duration; // certificate scroll continues to end
  const certScrollProgress = clamp((time - scrollStart) / (scrollEndCertificates - scrollStart), 0, 1);
  // Use a smooth cubic so it eases in
  const certScrollEased = Easing.easeInOutCubic(certScrollProgress);
  // Total upward drift over the scene — modest, so cards stay mostly visible
  const certScrollY = certScrollEased * H * 0.45;

  // Earth has its OWN faster scroll — only starts at recedeStart, then races up.
  const earthScrollProgress = clamp((time - recedeStart) / recedeDur, 0, 1);
  const earthScrollEased = Easing.easeOutCubic(earthScrollProgress);
  // Earth needs to travel from below frame all the way past the top:
  // total distance = H (frame height) + ~600 (layer thickness)
  const earthScrollY = earthScrollEased * (H + 600);

  // Recession progress (for desaturating cards as earth covers them)
  const recT = earthScrollProgress;

  // Overlay text fade: in at 1s after hero, out as accumulation overwhelms
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

  // Pre-compute card descriptors (memoized on tweaks)
  const PRE_PILED_COUNT = 14; // bottom-edge filler so soil backdrop never shows
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

  // Counter fades out as earth comes in
  const counterOpacity = Math.max(0, 1 - earthScrollProgress * 1.5);

  return (
    <>
      {/* Floor — soil texture (richer middle band of the soil PNG so the
          floor reads as warm earth, not near-black). The image is tall — we
          frame the upper-middle region by sizing it taller than the viewport
          and offsetting upward, leaving the deep-black bottom unused. */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#1a0e07',
        backgroundImage: earth && earth[0] ? `url("${earth[0]}")` : 'none',
        // size: 100% wide, 240% tall so we can scroll within the image;
        // position vertically at ~28% so we land in the rich brown middle band,
        // skipping both the soft top edge AND the near-black bottom.
        backgroundSize: '110% 240%',
        backgroundPosition: 'center 35%',
        backgroundRepeat: 'no-repeat',
      }}/>

      {/* Subtle warming + edge fade so the floor still has depth without
          actually darkening the texture. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
      }}/>

      {/* Overlay text — beneath the certificate pile */}
      <OverlayText time={time} opacity={overlayOpacity} />

      {/* All falling certificates */}
      {cards.map(card => (
        <Certificate
          key={card.i}
          card={card}
          src={certs[card.srcIndex]}
          time={time}
          recedeProgress={recT}
          scrollY={certScrollY}
        />
      ))}

      {/* Earth burial layers */}
      <EarthLayers scrollY={earthScrollY} srcs={earth} W={W} H={H} />

      {/* Counter */}
      {tweaks.showCounter && (
        <Counter
          visible={visibleCount}
          total={total}
          opacity={counterOpacity}
          scrollY={certScrollY}
        />
      )}
    </>
  );
}

window.CertificatesScene = CertificatesScene;
