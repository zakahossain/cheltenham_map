// ============================================================================
// Baltimore → Cheltenham — scrollytelling map
//
// For Prof. Rob Wells, JOUR389/689, Philip Merrill College of Journalism
//
// This map accompanies the Cheltenham story. It takes the 1938 reformatory
// roster — transcribed and researched by Capital News Service and our class —
// and places each boy's last known Baltimore address on a map, then scrolls
// the reader south to the facility where many of them died.
//
// Five stages:
//   1. Six featured boys in Baltimore — each with a documented fate after 1938
//   2. All 177 mapped boys shown across Baltimore
//   3. Zoomed-out corridor — parabolic lines trace every boy's path south;
//      Washington D.C. overlay appears for geographic context
//   4. Zoomed toward Joint Base Andrews — the facility sat just outside
//      what is now the base perimeter
//   5. Close-up of Cheltenham — the wooded cemetery where some boys were buried
//
// Data pipeline: scripts/03_build_geojson.py reads 02_boys_geocoded.csv and
// writes data/boys.geojson and data/anchors.geojson. Re-run that script any
// time the source CSV or anchor coordinates change.
//
// PNG overlays (dc_trace.png, jba_trace.png, cemetery_trace.png) were traced
// in Illustrator over Mapbox screenshots and registered to the viewport bounds
// recorded in OVERLAYS below. They are rendered as SVG <image> elements with
// mix-blend-mode: screen so they blend with the basemap rather than covering it.
// If the base map style ever changes, the bounds will need to be re-verified.
// ============================================================================

mapboxgl.accessToken = "pk.eyJ1IjoiemFrYWhvc3NhaW4iLCJhIjoiY21vOXR1Nm1wMDB5NTJxcTkwZHh4eWk5aiJ9.BOt5ybqF1zu6uC9T0qZxug";

// ---------------------------------------------------------------------------
// Camera presets — one per scroll stage
// ---------------------------------------------------------------------------
const STAGES = {
  1: { center: [-76.6134, 39.2949], zoom: 12.3, pitch: 0, bearing: 0 },
  2: { center: [-76.6119, 39.2922], zoom: 11.6, pitch: 0, bearing: 0 },
  3: { center: [-76.7931, 39.0527], zoom: 9.4,  pitch: 0, bearing: 0 },
  4: { center: [-76.9485, 38.8401], zoom: 10.5, pitch: 0, bearing: 0 },
  5: { center: [-76.8489, 38.7374], zoom: 13.4, pitch: 0, bearing: 0 },
};

// Six boys selected for Stage 1 because their post-Cheltenham fates are
// documented in the research: two killed, one died, one Army detention,
// one Maryland Penitentiary, one Crownsville State Hospital.
const FEATURED_BOYS = ["6256", "6085", "6698", "5904", "6404", "6682"];
// Eugene Duvall, 17     — Killed 1939
// Lawrence Harvey, 17   — Killed 1939
// William McKinney, 17  — Died 1939
// Robert Taylor, 20     — Army Detention (10 years) 1944
// Joseph Ward, 12       — Md. Pen. 1945 (10 years)
// Hobert Hooper, 13     — Crownsville 1939

// ---------------------------------------------------------------------------
// PNG overlay bounds — [NW, NE, SE, SW] in [lon, lat]
//
// Each set of coordinates was derived by screenshotting the Mapbox panel at
// the reference zoom/center, tracing the boundary in Illustrator at the same
// canvas size (2400 × 1800 px), then exporting a PNG. The four corners map
// directly to the viewport corners at the moment of the screenshot.
//
// NOTE TO SELF: if the site is ever published, double-check the cemetery
// overlay against the actual burial site location — the coordinates are based
// on satellite imagery and may need ground-truth verification.
// ---------------------------------------------------------------------------
const OVERLAYS = {
  washington_dc: {
    url: "../overlays/dc_trace.png",
    coordinates: [
      [-77.20386029999999, 38.99937645], // NW
      [-76.8457297,        38.99937645], // NE
      [-76.8457297,        38.79032355], // SE
      [-77.20386029999999, 38.79032355], // SW
    ],
  },
  joint_base_andrews: {
    url: "../overlays/jba_trace.png",
    coordinates: [
      [-76.9397, 38.8535], // NW
      [-76.7941, 38.8535], // NE
      [-76.7941, 38.7683], // SE
      [-76.9397, 38.7683], // SW
    ],
  },
  cheltenham_graves: {
    url: "../overlays/cemetery_trace.png",
    coordinates: [
      [-76.8671, 38.7481], // NW
      [-76.8307, 38.7481], // NE
      [-76.8307, 38.7267], // SE
      [-76.8671, 38.7267], // SW
    ],
  },
};

// SVG image elements for each overlay — populated in setupD3Overlay
let _overlayImages = {};

// ---------------------------------------------------------------------------
// Initialize map — interaction disabled; camera is driven by scroll
// ---------------------------------------------------------------------------
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: STAGES[1].center,
  zoom: STAGES[1].zoom,
  pitch: STAGES[1].pitch,
  bearing: STAGES[1].bearing,
  interactive: false,
});

map.on("load", async () => {
  const boys    = await fetch("../data/boys.geojson").then((r) => r.json());
  const anchors = await fetch("../data/anchors.geojson").then((r) => r.json());

  const getAnchor = (id) => anchors.features.find((f) => f.properties.id === id);

  // ---- Boys layers ----------------------------------------------------------

  map.addSource("boys", { type: "geojson", data: boys });

  map.addLayer({
    id: "boys-dots",
    type: "circle",
    source: "boys",
    paint: {
      "circle-radius": 5,
      "circle-color": "#5c2e10",
      "circle-stroke-color": "#e8dcbc",
      "circle-stroke-width": 1,
      "circle-opacity": 0,
      "circle-stroke-opacity": 0,
    },
  });

  // Soft glow ring — shown in Stage 2 to give the cluster a sense of density
  map.addLayer({
    id: "boys-halo",
    type: "circle",
    source: "boys",
    paint: {
      "circle-radius": 12,
      "circle-color": "#8b3a1a",
      "circle-opacity": 0,
      "circle-blur": 0.8,
    },
  }, "boys-dots");

  map.addLayer({
    id: "boys-labels",
    type: "symbol",
    source: "boys",
    filter: ["in", "id", ...FEATURED_BOYS],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-anchor": "left",
      "text-offset": [0.8, 0],
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#3a1f0e",
      "text-halo-color": "#e8dcbc",
      "text-halo-width": 1.5,
      "text-opacity": 0,
    },
  });

  // ---- Anchor layers --------------------------------------------------------

  map.addSource("anchors", { type: "geojson", data: anchors });

  map.addLayer({
    id: "anchor-dots",
    type: "circle",
    source: "anchors",
    // DC, JBA, and the cemetery are represented by PNG overlays, not dots
    filter: ["!in", "id", "washington_dc", "joint_base_andrews", "cheltenham_cemetery"],
    paint: {
      "circle-radius": 7,
      "circle-color": "#9c3a1f",
      "circle-stroke-color": "#e8dcbc",
      "circle-stroke-width": 2,
      "circle-opacity": 0,
    },
  });

  map.addLayer({
    id: "anchor-labels",
    type: "symbol",
    source: "anchors",
    layout: {
      "text-field": ["get", "short"],
      // DC and JBA labels are larger because they anchor geographic orientation
      "text-size": ["match", ["get", "id"],
        "washington_dc", 14,
        "joint_base_andrews", 14,
        11
      ],
      "text-anchor": "top",
      "text-offset": [0, 0.9],
    },
    paint: {
      "text-color": "#3a1f0e",
      "text-halo-color": "#e8dcbc",
      "text-halo-width": 1.5,
      "text-opacity": 0,
    },
  });

  // ---- Tooltip --------------------------------------------------------------
  // clientX/clientY (not pageY) because the map wrapper is position: fixed —
  // pageY includes scroll offset and places the tooltip off-screen mid-story

  const tooltip = document.getElementById("tooltip");
  map.on("mousemove", "boys-dots", (e) => {
    const f = e.features[0];
    tooltip.innerHTML = f.properties.tooltip;
    tooltip.style.left = e.originalEvent.clientX + "px";
    tooltip.style.top  = e.originalEvent.clientY + "px";
    tooltip.style.opacity = 1;
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "boys-dots", () => {
    tooltip.style.opacity = 0;
    map.getCanvas().style.cursor = "";
  });

  // ---- D3 overlay + scrollama ----------------------------------------------

  setupD3Overlay(boys, getAnchor("cheltenham_old"));
  initScrollama();
});

// ---------------------------------------------------------------------------
// D3 overlay — PNG overlays, parabolic lines (Stage 3+), pulse rings (Stage 1)
// ---------------------------------------------------------------------------
function setupD3Overlay(boys, cheltenham) {
  const svg = d3.select("#overlay");

  // Overlays sit at the bottom of the SVG stack so lines and pulses render
  // on top. mix-blend-mode: screen lets the basemap show through.
  const overlayGroup = svg.append("g").attr("class", "svg-overlays");
  for (const [id, spec] of Object.entries(OVERLAYS)) {
    _overlayImages[id] = overlayGroup.append("image")
      .attr("href", spec.url)
      .attr("preserveAspectRatio", "none")
      .style("opacity", 0)
      .style("mix-blend-mode", "multiply")
      // Sepia ink wash so the traced shapes read like fountain pen on aged paper
      .style("filter", "sepia(0.7) hue-rotate(-10deg) saturate(2) brightness(0.45)")
      .style("pointer-events", "none");
  }

  function updateOverlayPositions() {
    for (const [id, spec] of Object.entries(OVERLAYS)) {
      const [nw, ne, se] = spec.coordinates; // each is [lon, lat]
      const pNW = map.project(nw);
      const pNE = map.project(ne);
      const pSE = map.project(se);
      _overlayImages[id]
        .attr("x",      pNW.x)
        .attr("y",      pNW.y)
        .attr("width",  pNE.x - pNW.x)
        .attr("height", pSE.y - pNW.y);
    }
  }

  const pulseGroup = svg.append("g").attr("class", "pulses");
  const lineGroup  = svg.append("g").attr("class", "lines");

  function project(lonLat) { return map.project(lonLat); }

  // Arc lifts proportionally to horizontal distance, capped to avoid absurdly
  // tall curves for boys close to the Cheltenham anchor
  function parabola(start, end) {
    const mx   = (start.x + end.x) / 2;
    const lift = Math.min(Math.abs(end.x - start.x), 300) * 0.75;
    const cy   = Math.min(start.y, end.y) - lift;
    return `M ${start.x} ${start.y} Q ${mx} ${cy} ${end.x} ${end.y}`;
  }

  // ---- Pulse rings ----------------------------------------------------------

  let _pulseIds = [];

  function updatePulses() {
    const activeBoys = boys.features.filter(
      (f) => _pulseIds.includes(f.properties.id)
    );
    const circles = pulseGroup
      .selectAll("circle.pulse-ring")
      .data(activeBoys, (d) => d.properties.id);

    circles
      .enter()
      .append("circle")
      .attr("class", "pulse-ring")
      .attr("r", 10)
      .style("animation-delay", (_, i) => `${((i * 0.4) % 1.5).toFixed(2)}s`)
      .merge(circles)
      .attr("cx", (d) => project(d.geometry.coordinates).x)
      .attr("cy", (d) => project(d.geometry.coordinates).y);

    circles.exit().remove();
  }

  window.setPulseIds = function (ids) { _pulseIds = ids; updatePulses(); };

  // ---- Parabolic lines ------------------------------------------------------

  let _linesVisible = false;

  function render() {
    updateOverlayPositions();

    const chelt = project(cheltenham.geometry.coordinates);
    const paths = lineGroup
      .selectAll("path.line")
      .data(boys.features, (d) => d.properties.id);

    paths
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", "#3a1f0e")
      .attr("stroke-width", 0.8)
      .attr("stroke-opacity", 0)
      .attr("data-id", (d) => d.properties.id)
      .on("mousemove", function (event, d) {
        const tt = document.getElementById("tooltip");
        tt.innerHTML = d.properties.tooltip;
        tt.style.left = event.clientX + "px";
        tt.style.top  = event.clientY + "px";
        tt.style.opacity = 1;
        d3.select(this).attr("stroke-opacity", 1).attr("stroke-width", 1.6);
      })
      .on("mouseleave", function () {
        document.getElementById("tooltip").style.opacity = 0;
        d3.select(this).attr("stroke-opacity", 0.35).attr("stroke-width", 0.8);
      })
      .merge(paths)
      .attr("d", (d) => parabola(project(d.geometry.coordinates), chelt));

    paths.exit().remove();

    if (!_linesVisible) {
      lineGroup.selectAll("path.line").each(function () {
        const len = this.getTotalLength();
        d3.select(this).attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
      });
    }

    updatePulses();
  }

  window.setLinesVisible = function (visible, duration = 1800) {
    _linesVisible = visible;
    const lines = lineGroup.selectAll("path.line");
    if (visible) {
      if (duration === 0) {
        // Skip the stagger transition when lines must appear instantly (Stages 4/5)
        lines.interrupt()
          .attr("stroke-dasharray", null)
          .attr("stroke-dashoffset", null)
          .attr("stroke-opacity", 0.35);
      } else {
        lines
          .each(function () {
            const len = this.getTotalLength();
            d3.select(this).attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
          })
          .attr("stroke-opacity", 0.35)
          .transition()
          .duration(duration)
          .delay((_, i) => i * 30)
          .attr("stroke-dashoffset", 0);
      }
    } else {
      lines.interrupt().attr("stroke-opacity", 0).each(function () {
        const len = this.getTotalLength();
        d3.select(this).attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
      });
    }
  };

  map.on("move",    render);
  map.on("moveend", render);
  map.on("resize",  render);
  render();
}

// ---------------------------------------------------------------------------
// Scrollama
// ---------------------------------------------------------------------------
function initScrollama() {
  scrollama()
    .setup({ step: ".step", offset: 0.6, progress: false })
    .onStepEnter((response) => handleStep(parseInt(response.element.dataset.step, 10)));
}

function handleStep(step) {
  const preset     = STAGES[step];
  // Stage 4 flies a longer distance (Baltimore → Andrews), so it gets more time
  const flyDuration = step === 4 ? 3800 : 2200;
  if (preset) map.flyTo({ ...preset, duration: flyDuration, essential: true });

  switch (step) {
    case 1:
      map.setPaintProperty("boys-dots", "circle-radius", 5);
      map.setPaintProperty("boys-dots", "circle-opacity", 1);
      map.setPaintProperty("boys-dots", "circle-stroke-opacity", 1);
      map.setPaintProperty("boys-halo", "circle-opacity", 0);
      map.setPaintProperty("boys-labels", "text-opacity", 1);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      map.setFilter("boys-dots", ["in", "id", ...FEATURED_BOYS]);
      map.setFilter("boys-halo", ["in", "id", ...FEATURED_BOYS]);
      window.setLinesVisible(false, 0);
      window.setPulseIds(FEATURED_BOYS);
      setAnchorVisibility(0);
      setAllOverlays(0);
      break;

    case 2:
      map.setPaintProperty("boys-dots", "circle-radius", 5);
      map.setPaintProperty("boys-dots", "circle-opacity", 1);
      map.setPaintProperty("boys-dots", "circle-stroke-opacity", 1);
      map.setFilter("boys-dots", null);
      map.setFilter("boys-halo", null);
      map.setPaintProperty("boys-labels", "text-opacity", 0);
      map.setPaintProperty("boys-halo", "circle-opacity", 0.15);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(false, 0);
      window.setPulseIds([]);
      setAnchorVisibility(0);
      setAllOverlays(0);
      break;

    case 3:
      map.setFilter("boys-dots", null);
      map.setPaintProperty("boys-dots", "circle-radius", 3);
      map.setPaintProperty("boys-dots", "circle-opacity", 1);
      map.setPaintProperty("boys-dots", "circle-stroke-opacity", 1);
      map.setPaintProperty("boys-halo", "circle-opacity", 0);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(true, 1800);
      window.setPulseIds([]);
      setAnchorVisibility(1);
      fadeOverlay("washington_dc", 0.85);
      fadeOverlay("joint_base_andrews", 0);
      fadeOverlay("cheltenham_graves", 0);
      startGlow("washington_dc");
      break;

    case 4:
      map.setPaintProperty("boys-dots", "circle-radius", 3);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(true, 0);
      window.setPulseIds([]);
      setAnchorVisibility(1);
      // DC stays faintly visible for orientation, JBA is the focus
      fadeOverlay("washington_dc", 0.2);
      fadeOverlay("joint_base_andrews", 0.85);
      fadeOverlay("cheltenham_graves", 0);
      startGlow("joint_base_andrews");
      break;

    case 5:
      map.setPaintProperty("boys-dots", "circle-radius", 3);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(true, 0);
      window.setPulseIds([]);
      setAnchorVisibility(1);
      fadeOverlay("washington_dc", 0);
      // JBA stays faintly visible — we're still in its geographic shadow
      fadeOverlay("joint_base_andrews", 0.2);
      fadeOverlay("cheltenham_graves", 0.85);
      startGlow("cheltenham_graves");
      break;
  }
}

function setAnchorVisibility(opacity) {
  map.setPaintProperty("anchor-dots",   "circle-opacity", opacity);
  map.setPaintProperty("anchor-labels", "text-opacity",   opacity);
}

// Fast fade-in (300ms) so the overlay snaps onto the stage;
// slow fade-out (2000ms) so it lingers as the reader scrolls away.
// CSS transition handles the easing; the glow loop bypasses it.
function fadeOverlay(id, targetOpacity) {
  const el = _overlayImages[id].node();
  const duration = targetOpacity > 0 ? 300 : 2000;
  el.style.transition = `opacity ${duration}ms ease`;
  el.style.opacity = targetOpacity;
}

function setAllOverlays(opacity) {
  stopGlow();
  for (const id of Object.keys(OVERLAYS)) fadeOverlay(id, opacity);
}

let _glowId      = null;
let _glowRaf     = null;
let _glowTimeout = null;

function startGlow(id) {
  stopGlow();
  _glowId = id;
  // Wait for the 300ms fade-in before beginning the pulse loop
  _glowTimeout = setTimeout(() => {
    if (_glowId !== id) return;
    // Remove CSS transition so per-frame opacity updates apply instantly
    const el = _overlayImages[id].node();
    el.style.transition = "none";
    const t0 = performance.now();
    (function tick(t) {
      if (_glowId !== id) return;
      // Sine wave: oscillates between 0.35 (trough) and 0.90 (peak) over 1.5 s
      el.style.opacity = 0.625 + 0.275 * Math.sin((t - t0) / 1500 * 2 * Math.PI);
      _glowRaf = requestAnimationFrame(tick);
    })(t0);
  }, 350);
}

function stopGlow() {
  if (_glowTimeout) { clearTimeout(_glowTimeout); _glowTimeout = null; }
  if (_glowRaf)     { cancelAnimationFrame(_glowRaf); _glowRaf = null; }
  if (_glowId) {
    // Restore slow fade-out transition for the next hide
    _overlayImages[_glowId].node().style.transition = "opacity 2000ms ease";
    _glowId = null;
  }
}

// ---------------------------------------------------------------------------
// Keep the SVG overlay sized to the map panel
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  const overlay = document.getElementById("overlay");
  const rect    = document.getElementById("map-wrapper").getBoundingClientRect();
  overlay.setAttribute("width",  rect.width);
  overlay.setAttribute("height", rect.height);
});
window.dispatchEvent(new Event("resize"));
