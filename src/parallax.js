// ============================================================================
// parallax.js — scroll-driven parallax for the cemetery photograph.
//
// The photo's inner <div class="cemetery-photo-img"> is sized 160vh tall and
// positioned with top:-30vh inside the 100vh section, then translated on
// scroll by a fraction of the section's offset from the viewport top. The
// result: as the user scrolls past the section, the photo moves more slowly
// than the page, giving it depth.
// ============================================================================

(function () {
  const FACTOR = 0.3; // 0 = static, 1 = scrolls with page (no parallax effect)

  const section = document.getElementById("cemetery-photo");
  if (!section) return;
  const img = section.querySelector(".cemetery-photo-img");
  if (!img) return;

  let ticking = false;
  function update() {
    ticking = false;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    // Skip when the section is well outside the viewport — saves layout work.
    if (rect.bottom < -200 || rect.top > vh + 200) return;
    const offset = -rect.top * FACTOR;
    img.style.transform = `translateY(${offset}px)`;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
