/**
 * Regenerate DC reference screenshot for Illustrator tracing.
 * Run: node scripts/take_screenshot.js
 * Requires: python3 -m http.server 8000 --directory .
 */
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });

  // Capture console messages for debugging
  const logs = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[ERROR] ${err.message}`));

  console.log("Loading http://localhost:8000/src/...");
  try {
    await page.goto("http://localhost:8000/src/", { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    console.log("goto error:", e.message);
  }

  // Wait a flat 8s for tiles to load (avoid race with waitForFunction)
  console.log("Waiting 8s for map tiles...");
  await new Promise((r) => setTimeout(r, 8000));

  // Check map state
  const mapState = await page.evaluate(() => {
    if (!window.map) return { exists: false };
    return {
      exists: true,
      loaded: window.map.loaded(),
      styleLoaded: window.map.isStyleLoaded(),
    };
  }).catch((e) => ({ exists: false, error: e.message }));
  console.log("Map state:", mapState);

  if (logs.length) {
    console.log("Page logs:", logs.slice(0, 20).join("\n"));
  }

  // Take a debug screenshot now regardless
  await page.screenshot({ path: path.resolve("overlays/dc_debug.png") });
  console.log("Debug screenshot at overlays/dc_debug.png");

  if (mapState.exists && (mapState.loaded || mapState.styleLoaded)) {
    // Hide story, make map full-width
    await page.evaluate(() => {
      document.getElementById("story").style.display = "none";
      document.getElementById("map-wrapper").style.width = "100vw";
      window.map.resize();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Jump to DC view
    await page.evaluate(() => {
      return new Promise((resolve) => {
        window.map.jumpTo({ center: [-77.015, 38.893], zoom: 10.5 });
        window.map.once("idle", resolve);
        setTimeout(resolve, 5000); // fallback
      });
    });
    await new Promise((r) => setTimeout(r, 2500));

    await page.screenshot({ path: path.resolve("overlays/dc_trace_ref.png") });
    console.log("Wrote: overlays/dc_trace_ref.png");
  } else {
    console.log("Map did not load — check debug screenshot");
  }

  await browser.close();
})();
