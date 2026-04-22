// ============================================================================
// Baltimore → Cheltenham — scrollytelling map
//
// Stages:
//   1. Baltimore zoomed, 6 featured boys with name labels, pulsing pucks
//   2. Baltimore zoomed, all boys visible, labels gone
//   3. Zoomed-out corridor view — Washington D.C. PNG overlay fades in,
//      parabolic lines draw from each boy to old Cheltenham
//   4. Zoomed toward Joint Base Andrews — JBA PNG overlay highlighted
//   5. Cheltenham close-up — wooded cemetery PNG overlay highlighted
//
// Assumptions:
//   - data/boys.geojson and data/anchors.geojson exist (built by 03_build_geojson.py)
//   - overlays/ contains PNG traces: washington_dc.png, joint_base_andrews.png,
//     cheltenham_cemetery.png  (traced in Illustrator; bounds defined in OVERLAYS below)
// ============================================================================

mapboxgl.accessToken = "pk.eyJ1IjoiemFrYWhvc3NhaW4iLCJhIjoiY21vOXR1Nm1wMDB5NTJxcTkwZHh4eWk5aiJ9.BOt5ybqF1zu6uC9T0qZxug";

// ---------------------------------------------------------------------------
// Camera presets — tuned 2026-04-22
// ---------------------------------------------------------------------------
const STAGES = {
  1: { center: [-76.6134, 39.2949], zoom: 12.3, pitch: 0, bearing: 0 },
  2: { center: [-76.6119, 39.2922], zoom: 11.6, pitch: 0, bearing: 0 },
  3: { center: [-76.7931, 39.0527], zoom: 9.4,  pitch: 0, bearing: 0 },
  4: { center: [-76.9485, 38.8401], zoom: 10.5, pitch: 0, bearing: 0 }, // zoomed out ~45% from 11.4
  5: { center: [-76.8489, 38.7374], zoom: 13.4, pitch: 0, bearing: 0 },
};

// Boys whose stories anchor Stage 1 — picked for documented outcomes after Cheltenham
const FEATURED_BOYS = ["6256", "6085", "6698", "5904", "6404", "6682"];
// Eugene Duvall, 17     — Killed 1939
// Lawrence Harvey, 17   — Killed 1939
// William McKinney, 17  — Died 1939
// Robert Taylor, 20     — Army Detention (10 years) 1944
// Joseph Ward, 12       — Md. Pen. 1945 (10 years)
// Hobert Hooper, 13     — Crownsville 1939

// ---------------------------------------------------------------------------
// PNG overlay bounds — [NW, NE, SE, SW] in [lon, lat]
// Coordinates match the exact geographic extent of each *_trace_ref.png
// screenshot (zoom / center noted below). Trace PNGs must be exported at
// the same pixel dimensions as the reference screenshot (2400 × 1800 px).
// ---------------------------------------------------------------------------
const OVERLAYS = {
  washington_dc: {
    url: "../overlays/dc_trace.png",
    // dc_trace_ref.png — zoom 11.5, center [-77.0369, 38.9072], 1200×900 CSS px
    coordinates: [
      [-77.3283, 39.0772], // NW
      [-76.7455, 39.0772], // NE
      [-76.7455, 38.7372], // SE
      [-77.3283, 38.7372], // SW
    ],
  },
  joint_base_andrews: {
    url: "../overlays/jba_trace.png",
    // jba_trace_ref.png — zoom 12.5, center [-76.8669, 38.8109], 1200×900 CSS px
    coordinates: [
      [-77.0126, 38.8960], // NW
      [-76.7212, 38.8960], // NE
      [-76.7212, 38.7258], // SE
      [-77.0126, 38.7258], // SW
    ],
  },
  cheltenham_graves: {
    url: "../overlays/cemetery_trace.png",
    // cemetery_trace_ref.png — zoom 14.5, center [-76.8489, 38.7374], 1200×900 CSS px
    coordinates: [
      [-76.8853, 38.7587], // NW
      [-76.8125, 38.7587], // NE
      [-76.8125, 38.7161], // SE
      [-76.8853, 38.7161], // SW
    ],
  },
};

// ---------------------------------------------------------------------------
// Initialize map
// ---------------------------------------------------------------------------
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: STAGES[1].center,
  zoom: STAGES[1].zoom,
  pitch: STAGES[1].pitch,
  bearing: STAGES[1].bearing,
  interactive: false,
});

map.on("load", async () => {
  const boys    = await fetch("../data/boys.geojson").then((r) => r.json());
  const anchors = await fetch("../data/anchors.geojson").then((r) => r.json());

  window._boys    = boys;
  window._anchors = anchors;

  const getAnchor = (id) => anchors.features.find((f) => f.properties.id === id);

  // ---- Boys layers ----------------------------------------------------------

  map.addSource("boys", { type: "geojson", data: boys });

  map.addLayer({
    id: "boys-dots",
    type: "circle",
    source: "boys",
    paint: {
      "circle-radius": 5,
      "circle-color": "#4aa3df",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
      "circle-opacity": 0,
      "circle-stroke-opacity": 0,
    },
  });

  // Static blur halo — stage 2 only; stage 1 uses SVG pulse rings instead
  map.addLayer({
    id: "boys-halo",
    type: "circle",
    source: "boys",
    paint: {
      "circle-radius": 12,
      "circle-color": "#4aa3df",
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
      "text-color": "#ffffff",
      "text-halo-color": "#000000",
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
    // DC, JBA, and cemetery are shown via PNG overlays — no dot needed for those
    filter: ["!in", "id", "washington_dc", "joint_base_andrews", "cheltenham_cemetery"],
    paint: {
      "circle-radius": 7,
      "circle-color": "#e74c3c",
      "circle-stroke-color": "#ffffff",
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
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.9],
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#000000",
      "text-halo-width": 1.5,
      "text-opacity": 0,
    },
  });

  // ---- PNG overlays ---------------------------------------------------------

  for (const [id, spec] of Object.entries(OVERLAYS)) {
    map.addSource(`overlay-${id}`, {
      type: "image",
      url: spec.url,
      coordinates: spec.coordinates,
    });
    map.addLayer({
      id: `overlay-${id}`,
      type: "raster",
      source: `overlay-${id}`,
      paint: { "raster-opacity": 0 },
    });
  }

  // ---- Tooltip --------------------------------------------------------------

  const tooltip = document.getElementById("tooltip");
  map.on("mousemove", "boys-dots", (e) => {
    const f = e.features[0];
    tooltip.innerHTML = f.properties.tooltip;
    tooltip.style.left = e.originalEvent.pageX + "px";
    tooltip.style.top  = e.originalEvent.pageY + "px";
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
// D3 overlay — parabolic lines (Stage 3+) and animated pulse rings (Stage 1)
// ---------------------------------------------------------------------------
function setupD3Overlay(boys, cheltenham) {
  const svg = d3.select("#overlay");

  const pulseGroup = svg.append("g").attr("class", "pulses");
  const lineGroup  = svg.append("g").attr("class", "lines");

  function project(lonLat) { return map.project(lonLat); }

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
    const chelt = project(cheltenham.geometry.coordinates);
    const paths = lineGroup
      .selectAll("path.line")
      .data(boys.features, (d) => d.properties.id);

    paths
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", "#4aa3df")
      .attr("stroke-width", 0.8)
      .attr("stroke-opacity", 0)
      .attr("data-id", (d) => d.properties.id)
      .on("mousemove", function (event, d) {
        const tt = document.getElementById("tooltip");
        tt.innerHTML = d.properties.tooltip;
        tt.style.left = event.pageX + "px";
        tt.style.top  = event.pageY + "px";
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
    } else {
      lines.interrupt().attr("stroke-opacity", 0).each(function () {
        const len = this.getTotalLength();
        d3.select(this).attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
      });
    }
  };

  map.on("move", render);
  map.on("moveend", render);
  map.on("resize", render);
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
      // Full corridor — lines draw in, DC overlay fades in
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
      break;

    case 4:
      // JBA overlay highlighted, DC fades out
      map.setPaintProperty("boys-dots", "circle-radius", 3);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(true, 0);
      window.setPulseIds([]);
      setAnchorVisibility(1);
      fadeOverlay("washington_dc", 0);
      fadeOverlay("joint_base_andrews", 0.85);
      fadeOverlay("cheltenham_graves", 0);
      break;

    case 5:
      // Cemetery overlay highlighted
      map.setPaintProperty("boys-dots", "circle-radius", 3);
      map.setPaintProperty("anchor-dots", "circle-radius", 7);
      window.setLinesVisible(true, 0);
      window.setPulseIds([]);
      setAnchorVisibility(1);
      fadeOverlay("washington_dc", 0);
      fadeOverlay("joint_base_andrews", 0.2);
      fadeOverlay("cheltenham_graves", 0.85);
      break;
  }
}

function setAnchorVisibility(opacity) {
  map.setPaintProperty("anchor-dots",   "circle-opacity", opacity);
  map.setPaintProperty("anchor-labels", "text-opacity",   opacity);
}

function fadeOverlay(id, opacity) {
  map.setPaintProperty(`overlay-${id}`, "raster-opacity", opacity);
}

function setAllOverlays(opacity) {
  for (const id of Object.keys(OVERLAYS)) fadeOverlay(id, opacity);
}

// ---------------------------------------------------------------------------
// Dev helpers — available in the browser console
// ---------------------------------------------------------------------------

// Print current camera state formatted for STAGES — paste result into map.js
window.printStage = function (n) {
  const c = map.getCenter();
  console.log(
    `${n}: { center: [${c.lng.toFixed(4)}, ${c.lat.toFixed(4)}], ` +
    `zoom: ${map.getZoom().toFixed(1)}, pitch: ${map.getPitch().toFixed(0)}, bearing: ${map.getBearing().toFixed(0)} },`
  );
};

// Print current viewport corners formatted for OVERLAYS — paste result into map.js
// Then screenshot the map panel: that screenshot IS the Illustrator artboard.
window.printOverlayBounds = function (id) {
  const b  = map.getBounds();
  const nw = b.getNorthWest();
  const ne = b.getNorthEast();
  const se = b.getSouthEast();
  const sw = b.getSouthWest();
  console.log(
    `${id}: [\n` +
    `  [${nw.lng.toFixed(4)}, ${nw.lat.toFixed(4)}], // NW\n` +
    `  [${ne.lng.toFixed(4)}, ${ne.lat.toFixed(4)}], // NE\n` +
    `  [${se.lng.toFixed(4)}, ${se.lat.toFixed(4)}], // SE\n` +
    `  [${sw.lng.toFixed(4)}, ${sw.lat.toFixed(4)}], // SW\n]`
  );
};

// Enable all map interaction handlers (useful for camera tuning)
window.enableInteraction = function () {
  map.scrollZoom.enable();
  map.dragPan.enable();
  map.dragRotate.enable();
  map.keyboard.enable();
  map.doubleClickZoom.enable();
  map.touchZoomRotate.enable();
  console.log("Map interaction enabled. Use printStage(n) and printOverlayBounds(id) to capture values.");
};

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  const overlay = document.getElementById("overlay");
  const rect    = document.getElementById("map-wrapper").getBoundingClientRect();
  overlay.setAttribute("width",  rect.width);
  overlay.setAttribute("height", rect.height);
});
window.dispatchEvent(new Event("resize"));
