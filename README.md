# Baltimore → Cheltenham Scrollytelling Map

A scroll-triggered map reconstructing the pipeline from Baltimore neighborhoods to
the House of Reformation and Instruction for Colored Children at Cheltenham.

**Dataset:** 1938 Cheltenham list (260 boys, 182 with Baltimore street addresses)
**Stage:** MVP scaffold — data cleaning, geocoding, map rendering pipeline ready
to run.

---

## Project structure

```
cheltenham-map/
├── data/
│   ├── cheltenham_list_1938.csv        # Raw input
│   ├── 01_boys_cleaned.csv             # After cleaning/dedup (built by 01_clean.py)
│   ├── 01_boys_baltimore_only.csv      # Baltimore-candidate subset
│   ├── 02_boys_geocoded.csv            # After geocoding (built by 02_geocode.py)
│   ├── 02_geocoding_failures.csv       # Rows that need manual geocoding
│   ├── boys.geojson                    # Final map data (built by 03_build_geojson.py)
│   └── anchors.geojson                 # Fixed locations (White House, Capitol, etc.)
├── scripts/
│   ├── 01_clean.py
│   ├── 02_geocode.py
│   └── 03_build_geojson.py
├── src/
│   ├── index.html
│   ├── map.js
│   └── styles.css
├── overlays/                           # Drop your Illustrator-traced PNGs here
│   ├── white_house.png
│   ├── capitol.png
│   ├── joint_base_andrews.png
│   └── cheltenham_facility.png         # Old reformatory footprint (Stage 5)
└── README.md
```

---

## Run the pipeline

```bash
# Setup (once)
pip install pandas requests tenacity

# Step 1 — Clean (runs in seconds)
python scripts/01_clean.py \
  --input  data/cheltenham_list_1938.csv \
  --output data/01_boys_cleaned.csv

# Step 2 — Geocode (slower; ~3–5 minutes for 182 addresses with Nominatim fallback)
python scripts/02_geocode.py \
  --input  data/01_boys_baltimore_only.csv \
  --output data/02_boys_geocoded.csv

# Step 3 — Build GeoJSON
python scripts/03_build_geojson.py \
  --input         data/02_boys_geocoded.csv \
  --boys-output   data/boys.geojson \
  --anchors-output data/anchors.geojson

# Step 4 — Serve the map (Mapbox GL needs to be served over http)
# Serve from the PROJECT ROOT so ../data/ and ../overlays/ resolve correctly
python3 -m http.server 8000
# Then open http://localhost:8000/src/
```

---

## Before you run the map

1. **Get a Mapbox access token** at [account.mapbox.com](https://account.mapbox.com/access-tokens/). Free tier is fine.
2. In `src/map.js`, replace `"YOUR_MAPBOX_TOKEN_HERE"` with your token.
3. Verify anchor coordinates in `scripts/03_build_geojson.py` — especially the
   old Cheltenham facility and the wooded cemetery. The ones in the script are
   approximate and marked `VERIFY COORDINATES`.
4. The four PNG overlays in `overlays/` are placeholders. Trace building
   outlines in Illustrator, export transparent PNGs, update the `OVERLAYS`
   bounds in `map.js` so each image is anchored to the correct geographic box.
   The four are: White House, US Capitol, Joint Base Andrews, and the old
   Cheltenham reformatory facility.

---

## What the scaffold does today vs. what Claude Code should tighten

### Already built
- Five scrollama-triggered stages with camera flyTo transitions
- Mapbox circle layers for boys + anchors, with stage-based opacity and filters
- D3 SVG overlay for parabolic lines, one path per boy ending at old Cheltenham
- Hover tooltip on both pucks and lines
- PNG overlay layer per building (white_house, capitol, joint_base_andrews,
  cheltenham_facility)

### Known rough edges to iterate on with Claude Code

1. **Puck radiating circles.** Currently a static halo layer. Claude Code: add
   a proper CSS/SVG pulse so each puck looks like a sonar ping at 1.5s intervals.
2. **Line draw-in animation.** Currently fades all lines simultaneously.
   Claude Code: stagger the draw-in with SVG `stroke-dasharray` + `dashoffset`
   animation so lines appear to draw from Baltimore origin → Cheltenham over
   ~2 seconds each, staggered.
3. **Label collision in Stage 1.** `FEATURED_BOYS` is a placeholder array of
   six IDs. Replace with actual boys whose stories you're surfacing — ideally
   ones with richer "Later" data in the CSV.
4. **Camera presets need tuning.** The `STAGES` object in `map.js` has starting
   coordinates. Preview at each stage and adjust until framing is right.
5. **PNG overlay bounds are guessed.** When you trace White House, Capitol,
   Joint Base Andrews, and the old Cheltenham facility in Illustrator, export
   them with consistent canvas bounds matched to the real lat/lon corners,
   then update `OVERLAYS` in `map.js`.
6. **Transition timing.** Mapbox `flyTo` duration is 2.2s across the board.
   Claude Code: ease the DC→Cheltenham transition (stage 3→4) longer so the
   parabolic lines have time to breathe visually.

---

## Prompts to hand Claude Code

### Setup check
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

---

## Editorial guardrails baked in

- **Nothing fabricated.** If `address_year`, `more_recent_address`, or age
  are missing for a boy, the tooltip omits those clauses rather than guessing.
- **The 4 duplicate inmate numbers** were handled per project decisions:
  6637, 6658, 6702 were merged (same boy, different researcher); 6670 was
  split into 6670a (Hamilton) and 6670b (Johnson) as two distinct boys.
- **Non-Baltimore boys excluded from the map** but preserved in
  `01_boys_cleaned.csv` so they're recoverable for future expansion.

---

## What's deferred

- **Age at committal / year committed** — the 1938 list gives us one snapshot
  (age in 1938 = field `age`). True age-at-intake would require reformatory
  admissions books. Tooltip is written to work with what we have today.
- **Cheltenham wooded cemetery precise boundary** — currently an approximate
  point. A polygon outline would be stronger for Stage 5; trace in Illustrator
  or QGIS from satellite imagery.

---

## Geocoding note (for the map record)

**177 of 182 Baltimore addresses** were successfully geocoded and appear on the
map. Five addresses could not be resolved by either the US Census Geocoder or
OpenStreetMap Nominatim, even after correcting common abbreviations and
misspellings. They are almost certainly streets eliminated or renumbered during
Baltimore's mid-20th-century urban renewal:

| Inmate # | Name | Address as recorded |
|----------|------|---------------------|
| 6065 | Stephen Boardley | 1603 Young's Alley |
| 6762 | Francis Barnes | 1211 Carson St. |
| 5459 | Harold Hurt or Durham | 405 Perry St. |
| 6523 | Ostean Riley | 344 Camel St. |
| 6124 | Benjamin Scott | 615 Bradley St. |

These five boys are preserved in `data/02_boys_geocoded.csv` and
`data/02_geocoding_failures.csv` but do not appear as map points. Manual lookup
in Sanborn fire insurance maps or the Baltimore City Archives may recover their
locations for a future revision.
