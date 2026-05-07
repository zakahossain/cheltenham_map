// ============================================================================
// burial.js — soil burial layer + soil headline, driven by total page scroll.
//
// Lives OUTSIDE the React Act I stage so the soil PNG can extend below the
// sticky pin's bounds and use its bottom transparent edge to reveal the map
// underneath as the user scrolls past Act I.
//
// Scroll mapping (defined relative to the #act-i section + #soil-bridge):
//   - Burial begins ~84% into Act I (cards have finished accumulating)
//   - Soil at peak coverage around the moment Act I's pin un-sticks
//   - Soil clears completely by the end of #soil-bridge (100vh past Act I)
// ============================================================================

(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let burialEl, imgEl, headlineEl, sectionEl, bridgeEl;
  let lastProgress = -1;

  function init() {
    burialEl = document.getElementById("soil-burial");
    imgEl = burialEl ? burialEl.querySelector("img") : null;
    headlineEl = document.getElementById("soil-headline");
    sectionEl = document.getElementById("act-i");
    bridgeEl = document.getElementById("soil-bridge");
    if (!burialEl || !imgEl || !sectionEl || !bridgeEl) return;

    if (imgEl.complete && imgEl.naturalHeight > 0) {
      onScroll();
    } else {
      imgEl.addEventListener("load", onScroll, { once: true });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    if (!sectionEl || !imgEl) return;

    const vh = window.innerHeight;
    const actITop = sectionEl.offsetTop;
    const actIH = sectionEl.offsetHeight;
    const actIBottom = actITop + actIH;
    const bridgeBottom = actIBottom + bridgeEl.offsetHeight;

    // Burial scroll range:
    //   - starts when the user has scrolled into the last ~16% of Act I
    //   - ends when they've fully scrolled through #soil-bridge
    const burialStart = actITop + actIH * 0.84 - vh;
    const burialEnd = bridgeBottom;
    const range = burialEnd - burialStart;
    if (range <= 0) return;

    const progress = clamp((window.scrollY - burialStart) / range, 0, 1);
    if (progress === lastProgress) return;
    lastProgress = progress;

    // Compute soil img translateY. Source img is positioned at top:0 of the
    // fixed #soil-burial container (which fills the viewport). At progress=0
    // we want the img entirely below viewport; at progress=1 entirely above.
    // Y_OFFSET shifts the whole trajectory upward on screen.
    const Y_OFFSET = -100;
    const imgH = imgEl.offsetHeight;
    const startY = vh + Y_OFFSET;
    const endY = -imgH + Y_OFFSET;

    // Ease so the soil rises naturally and then floats up smoothly.
    const eased = easeInOutCubic(progress);
    const y = startY + (endY - startY) * eased;
    imgEl.style.transform = `translateY(${y}px)`;

    // Hide the burial layer entirely outside its active range — saves paint
    // cost and keeps it from intercepting anything when off-screen.
    burialEl.style.visibility = progress > 0 && progress < 1 ? "visible" : "hidden";

    // Headline opacity:
    //   fade in 0.30 → 0.50 (soil approaching full coverage)
    //   hold     0.50 → 0.70 (soil at peak)
    //   fade out 0.70 → 0.85 (soil starting to retreat)
    let headlineOpacity = 0;
    if (progress >= 0.30 && progress < 0.50) {
      headlineOpacity = (progress - 0.30) / 0.20;
    } else if (progress >= 0.50 && progress <= 0.70) {
      headlineOpacity = 1;
    } else if (progress > 0.70 && progress <= 0.85) {
      headlineOpacity = 1 - (progress - 0.70) / 0.15;
    }
    if (headlineEl) {
      headlineEl.style.opacity = String(headlineOpacity);
      headlineEl.style.visibility = headlineOpacity > 0.01 ? "visible" : "hidden";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
