# From Baltimore to Cheltenham
### A scrollytelling map — JOUR389/689, Philip Merrill College of Journalism
**Prof. Rob Wells** | University of Maryland

---

## What this is

Between 1870 and 1940, more than 230 Black boys died in state custody at the House of Reformation and Instruction for Colored Children at Cheltenham, Maryland. This map is an attempt to put them back on the ground.

Starting from a 1938 annual report transcribed and researched by Capital News Service and our class, I reconstructed the last known Baltimore home addresses of 182 boys who were alive at the facility that year. Of those, 177 addresses could be placed on a modern map. The map then scrolls the reader 30 miles south from those Baltimore neighborhoods to Cheltenham — first showing the corridor to Washington D.C., then zooming to the grounds of what is now Joint Base Andrews, and finally to the wooded cemetery where some of those boys are buried.

A hover tooltip tells you who he was and, where the report documents him, what happened to him next.

I would like to add residential locations of more boys committed to Cheltenham, perhaps in a timeline format.

This wireframe has details on how I would like the page to look like: https://zakahossain.github.io/jour628t/wireframe/ 


---

## Project structure

```
cheltenham-map/
├── data/
│   ├── cheltenham_list_1938.csv        # Raw input — the 1938 Cheltenham roster
│   ├── 01_boys_cleaned.csv             # After dedup and cleaning (built by 01_clean.py)
│   ├── 01_boys_baltimore_only.csv      # Baltimore-only subset sent to geocoding
│   ├── 02_boys_geocoded.csv            # With lat/lon added (built by 02_geocode.py)
│   ├── 02_geocoding_failures.csv       # Five addresses that couldn't be resolved
│   ├── boys.geojson                    # Final map data (built by 03_build_geojson.py)
│   └── anchors.geojson                 # Fixed locations: old facility, cemetery, DC, Andrews
├── scripts/
│   ├── 01_clean.py                     # Parse, dedup, flag Baltimore candidates
│   ├── 02_geocode.py                   # Census Geocoder → Nominatim fallback
│   └── 03_build_geojson.py             # Build GeoJSON + tooltips
├── src/
│   ├── index.html                      # Page structure and scroll narrative text
│   ├── map.js                          # All map logic: layers, D3 overlay, scroll stages
│   └── styles.css                      # Layout and card styles
├── overlays/                           # Illustrator-traced PNGs registered to map bounds
│   ├── dc_trace.png
│   ├── jba_trace.png
│   └── cemetery_trace.png
└── README.md
```

---

## The data pipeline

```
data/cheltenham_list_1938.csv
        ↓  scripts/01_clean.py
data/01_boys_cleaned.csv  +  01_boys_baltimore_only.csv
        ↓  scripts/02_geocode.py
data/02_boys_geocoded.csv  +  02_geocoding_failures.csv
        ↓  scripts/03_build_geojson.py
data/boys.geojson  +  data/anchors.geojson
        ↓  src/map.js
        The map
```

**Step 1 — Clean (`01_clean.py`):** The raw CSV had years embedded in address strings (e.g. `306 N. Poppleton St. 1934`), four duplicate inmate numbers requiring case-by-case decisions, and addresses from across Maryland that weren't relevant to a Baltimore map. This script separates year from address text, flags Baltimore candidates by pattern-matching street numbers and excluding known non-Baltimore place names, and resolves the four duplicates: three merges (same boy, different researcher entries), one split into `6670a` and `6670b` because two genuinely different boys were recorded under the same number.

**Step 2 — Geocode (`02_geocode.py`):** Takes each cleaned Baltimore address and queries two APIs in sequence — the US Census Geocoder first, then OpenStreetMap Nominatim as a fallback. Returns latitude and longitude for each address it can resolve, logs failures separately for manual review.

**Step 3 — Build GeoJSON (`03_build_geojson.py`):** Converts the geocoded CSV into two GeoJSON files — one for the boys (177 point features), one for fixed anchor locations (old Cheltenham facility, the cemetery, Washington D.C., Joint Base Andrews). Each boy feature carries a pre-built HTML tooltip string.

**Step 4 — The map (`src/map.js`):** Reads both GeoJSON files, adds Mapbox layers, draws D3 SVG arcs on top of the map, and connects scroll position to camera transitions via Scrollama. Five scroll stages: six featured boys → all 177 boys → corridor with arcs → Joint Base Andrews → Cheltenham cemetery.

---

## How to run it

```bash
# Install Python dependencies (once)
pip install pandas requests tenacity

# Step 1 — Clean
python scripts/01_clean.py \
  --input  data/cheltenham_list_1938.csv \
  --output data/01_boys_cleaned.csv

# Step 2 — Geocode (~3–5 minutes; hits two external APIs)
python scripts/02_geocode.py \
  --input  data/01_boys_baltimore_only.csv \
  --output data/02_boys_geocoded.csv

# Step 3 — Build GeoJSON
python scripts/03_build_geojson.py \
  --input          data/02_boys_geocoded.csv \
  --boys-output    data/boys.geojson \
  --anchors-output data/anchors.geojson

# Step 4 — Serve locally (Mapbox GL JS requires http, not file://)
# Serve from the PROJECT ROOT so ../data/ and ../overlays/ resolve correctly
python3 -m http.server 8000
# Open: http://localhost:8000/src/
```

Before running the map, replace the Mapbox token in `src/map.js` line 31 with your own from [account.mapbox.com](https://account.mapbox.com/access-tokens/). The free tier is sufficient.

---

## What I learned

### GeoJSON

I hadn't worked with GeoJSON before this project. The format is simpler than it looks — it's just JSON that follows a specific shape: a `FeatureCollection` contains an array of `Feature` objects, each with a `geometry` (the coordinates and shape type) and `properties` (anything you want to attach, like a name or tooltip).

The thing that tripped me up immediately: GeoJSON stores coordinates as `[longitude, latitude]`, not `[latitude, longitude]`. That's the opposite of how most people write coordinates verbally. I placed every boy in the Atlantic Ocean on my first attempt.

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-76.61, 39.29] },
  "properties": { "name": "William Brown", "age": 17 }
}
```

### Geocoding

Geocoding is the process of turning a human-readable address into geographic coordinates. I used two free APIs in sequence:

- **US Census Geocoder** ([geocoding.geo.census.gov](https://geocoding.geo.census.gov/geocoder/)) — no API key required, excellent accuracy for US street addresses. Primary source for this project.
- **OpenStreetMap Nominatim** ([nominatim.org](https://nominatim.org/)) — free fallback. Requires a descriptive `User-Agent` header and at least 1 second between requests or calls get blocked.

The humbling part: five addresses failed both APIs entirely. Streets like "Young's Alley," "Camel St.," and "Bradley St." don't appear on any modern map because they were demolished or renumbered during Baltimore's mid-20th-century urban renewal. The boys' addresses are accurate — the streets just no longer exist. Those five boys are preserved in `02_geocoding_failures.csv`; they are not missing from the data, they are missing from the modern city.

| Inmate # | Name | Address as recorded |
|---|---|---|
| 6065 | Stephen Boardley | 1603 Young's Alley |
| 6762 | Francis Barnes | 1211 Carson St. |
| 5459 | Harold Hurt or Durham | 405 Perry St. |
| 6523 | Ostean Riley | 344 Camel St. |
| 6124 | Benjamin Scott | 615 Bradley St. |

Manual lookup in Sanborn fire insurance maps or the Baltimore City Archives may recover their locations for a future revision.

### Scrollytelling with Scrollama

Scrollama ([github.com/russellsamora/scrollama](https://github.com/russellsamora/scrollama)) watches which "step" element is currently in the viewport and fires a callback when it changes. The key insight: scroll position is just state. When the user reaches Step 3, I want certain layers visible and the camera at a certain position. Scrollama handles the detection; I handle the response.

```js
scrollama()
  .setup({ step: ".step", offset: 0.6 })
  .onStepEnter((response) => handleStep(parseInt(response.element.dataset.step, 10)));
```

`offset: 0.6` means the step triggers when it's 60% up the viewport — which felt natural for a layout where the map is pinned left and the text scrolls on the right.

### D3 and Mapbox working together

Mapbox GL JS renders the geographic base layer — tiles, circle dots. D3 draws an SVG element that sits on top at the same size. D3 doesn't know anything about geography; it draws in pixel space. So every time the map moves (pan, zoom, or camera `flyTo`), I re-project all geographic coordinates into pixel positions using `map.project([lon, lat])` and update the SVG paths:

```js
map.on("move", render);
map.on("moveend", render);
```

Without those listeners, the arcs stay frozen while the map slides underneath them.

### Parabolic arcs with SVG

Each arc is a quadratic Bézier curve using the SVG path `Q` command — one control point pulled above the midpoint of the two endpoints makes a smooth curve. The `lift` variable scales with horizontal distance so nearby boys get a shallow arc and distant ones get a higher one, capped so no arc becomes absurdly tall:

```js
function parabola(start, end) {
  const mx   = (start.x + end.x) / 2;
  const lift = Math.min(Math.abs(end.x - start.x), 300) * 0.75;
  const cy   = Math.min(start.y, end.y) - lift;
  return `M ${start.x} ${start.y} Q ${mx} ${cy} ${end.x} ${end.y}`;
}
```

Reference: [MDN — SVG Paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)

### The line draw-in animation

When Stage 3 enters, the arcs draw themselves in sequentially rather than appearing all at once. This uses a standard SVG technique: set `stroke-dasharray` to the path's total length and `stroke-dashoffset` to the same value (making the line invisible), then animate `dashoffset` to zero (making it fully drawn). Staggering the delay by 30ms per line creates the sequential effect:

```js
lines.each(function () {
  const len = this.getTotalLength();
  d3.select(this).attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
})
.transition().duration(1800)
.delay((_, i) => i * 30)
.attr("stroke-dashoffset", 0);
```

Reference: [CSS-Tricks — How SVG Line Animation Works](https://css-tricks.com/svg-line-animation-works/)

### The glow pulse with requestAnimationFrame

The PNG overlays for D.C., Joint Base Andrews, and the cemetery pulse when active. I tried CSS `@keyframes` but couldn't stop it cleanly from JavaScript mid-animation. `requestAnimationFrame` gave full control — a sine wave oscillates opacity between 0.35 and 0.90 over 1.5 seconds, and cancelling the animation frame ID stops it instantly:

```js
const t0 = performance.now();
(function tick(t) {
  el.style.opacity = 0.625 + 0.275 * Math.sin((t - t0) / 1500 * 2 * Math.PI);
  _glowRaf = requestAnimationFrame(tick);
})(t0);
```

Reference: [MDN — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

### PNG overlays and mix-blend-mode

I traced overlays in Illustrator over Mapbox screenshots at known zoom/center values, then exported as transparent PNGs. They're rendered as SVG `<image>` elements sized and positioned to match the geographic bounding box of each area. `mix-blend-mode: screen` lets the map tiles show through — on a dark basemap, screen blending makes the overlay appear to glow rather than sitting on top as a hard rectangle.

This was the most frustrating part of the project and took over two hours. The problem is that the SVG sits on top of the Mapbox canvas as a completely separate element — there's no automatic connection between a geographic coordinate and a pixel position. You have to compute that yourself using `map.project()` every time the map moves. Getting the four corner coordinates of each overlay exactly right meant a lot of iteration: trace in Illustrator, export, load in the browser, see it's off, adjust. I spent most of that time in the browser's DevTools — using the Elements panel to inspect the live `x`, `y`, `width`, and `height` attributes on the SVG `<image>` node, then testing corrections directly in the console without reloading:

```js
// pasting this into the DevTools console to check where a coordinate lands
map.project([-77.20386, 38.99937])
```

Adjusting one corner shifts the whole image relative to the map, so a small error in one coordinate would shear the overlay. The cemetery overlay was the hardest — it's a small area at a high zoom level so any misalignment was immediately obvious. The workflow that finally worked: screenshot the map at the exact zoom and center, measure pixel offsets in Illustrator against the canvas edges, convert those back to lat/lon, paste into the console to verify, then commit to the code.

---

## Editorial guardrails

The tooltip for each boy is built strictly from what's in the data. If a field is missing — no recorded age, no later address, no documented fate — that sentence is omitted rather than filled in with an assumption. A tooltip might be as spare as:

> **Harold Hurt or Durham** was 16 at Cheltenham in 1938.

That incompleteness is part of the record. These boys were not well-documented by the state that held them. Inventing detail to fill the silence would be a second erasure.

The four duplicate inmate numbers were resolved per explicit project decisions documented in `01_clean.py`: 6637, 6658, and 6702 were merged (same boy, different researcher entries); 6670 was split into `6670a` (Hamilton) and `6670b` (Johnson) because they are two distinct boys recorded under the same number. Non-Baltimore boys are excluded from the map but preserved in `01_boys_cleaned.csv` so they're recoverable for future expansion.

---

## Known limitations and what's deferred

- **Five ungeocoded boys.** The five addresses in `02_geocoding_failures.csv` could not be resolved by either geocoding API. Sanborn fire insurance maps or the Baltimore City Archives may recover them.
- **Age at committal vs. age in 1938.** The roster gives age as of 1938, not age at intake. True age-at-commitment would require the reformatory's admissions books. Tooltips are written around what we have.
- **Cheltenham cemetery boundary.** Currently an approximate point coordinate. A traced polygon from satellite imagery would be more precise and more affecting.
- **PNG overlay bounds need ground-truthing.** The overlay coordinates in `map.js` were derived by screenshotting the Mapbox panel at specific zoom/center values and registering the PNG corners to the viewport corners. If the base map style changes, the bounds will need re-verification.
- **Mobile layout.** The fixed-position map and side-scroll layout are desktop-only. A phone would need a different approach.
- **Accessibility.** The map is not screen-reader accessible. The narrative text is, but the interactive dots and arcs have no keyboard equivalent.

---

## Sources

| Tool / Resource | Used for |
|---|---|
| [Mapbox GL JS v3.8](https://docs.mapbox.com/mapbox-gl-js/) | Base map tiles, circle layers, `flyTo` camera transitions |
| [Scrollama v3.2](https://github.com/russellsamora/scrollama) | Scroll-step detection driving stage transitions |
| [D3.js v7](https://d3js.org/) | SVG arc rendering and transitions |
| [US Census Geocoder](https://geocoding.geo.census.gov/geocoder/) | Primary geocoding API (free, no key) |
| [OpenStreetMap Nominatim](https://nominatim.org/) | Fallback geocoding API |
| [tenacity (Python)](https://tenacity.readthedocs.io/) | Retry logic for geocoding API calls |
| [MDN — SVG Paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths) | Quadratic Bézier path command (`Q`) |
| [CSS-Tricks — SVG Line Animation](https://css-tricks.com/svg-line-animation-works/) | `stroke-dasharray` draw-in technique |
| [MDN — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) | Glow pulse animation loop |
| Capital News Service / JOUR389/689 | Source data — 1938 Cheltenham roster |
| [1938 Cheltenham list (Google Sheets)](https://docs.google.com/spreadsheets/d/1OShFjVz1k2KupM2i1CsGSJpovwiGsaM_9NQIaehUFzU/edit?gid=225650106#gid=225650106) | Raw dataset |

---

## Claude Code prompts

The following prompts were used with Claude Code during development and are preserved here for reproducibility.

### Run the full pipeline
```
Run the pipeline end-to-end. Confirm data/boys.geojson has ~180 features and
report any geocoding failures so I can inspect them manually.
```

### Polish the pulse
```
In src/map.js the 'boys-halo' layer is a static blurred circle. Replace it with
an animated pulse: each puck emits a ring that expands from radius 5 to 18 and
fades from opacity 0.45 to 0 over 1.5 seconds, on a loop. Use CSS animations
on an SVG overlay rather than Mapbox paint properties (Mapbox doesn't support
keyframe animations natively).
```

### Stagger the line draw-in
```
When stage 3 enters, the parabolic lines should draw in sequentially over ~2
seconds, staggered 30ms apart. Use stroke-dasharray + stroke-dashoffset
animation on the D3 path elements. Each line starts invisible (dashoffset =
path length) and animates to fully drawn (dashoffset = 0). Reset on stage back.
```

### Stage 1 featured-boys selection
```
Read data/02_boys_geocoded.csv. Pick 6 boys who have 'more_recent_address'
filled in with poignant data (death, military, another institution). Update
FEATURED_BOYS in map.js with their inmate_no_resolved values and print which
boys you chose and why.
```

### Manual geocoding triage
```
Read data/02_geocoding_failures.csv. For each failed address, suggest a
likely modern equivalent or flag it as definitely-gone (urban renewal era
streets that no longer exist). Output data/geocoding_manual_review.csv with
columns: inmate_no, address, suggested_action, notes.
```
