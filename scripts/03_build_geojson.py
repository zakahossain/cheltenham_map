"""
Build GeoJSON files for the map:
  - data/boys.geojson    : one Point per boy with tooltip properties
  - data/anchors.geojson : key locations (Washington D.C., Andrews,
                           old Cheltenham facility, Cheltenham wooded cemetery)

Run:
    python scripts/03_build_geojson.py \
        --input data/02_boys_geocoded.csv \
        --boys-output data/boys.geojson \
        --anchors-output data/anchors.geojson
"""
import argparse
import json
from pathlib import Path

import pandas as pd


# Anchor coordinates — verify these before publishing
ANCHORS = [
    {
        "id": "cheltenham_old",
        "name": "House of Reformation and Instruction for Colored Children (original site)",
        "short": "Old Cheltenham facility",
        "lat": 38.7394,
        "lon": -76.8483,
        "note": "VERIFY COORDINATES with on-site research. Adjacent to current facility.",
    },
    {
        "id": "cheltenham_cemetery",
        "name": "Cheltenham wooded cemetery",
        "short": "Cemetery (burial site)",
        "lat": 38.7410,
        "lon": -76.8500,
        "note": "VERIFY COORDINATES. Adjacent to Cheltenham Veterans Cemetery.",
    },
    {
        "id": "washington_dc",
        "name": "Washington, D.C.",
        "short": "Washington, D.C.",
        "lat": 38.9072,
        "lon": -77.0369,
    },
    {
        "id": "joint_base_andrews",
        "name": "Joint Base Andrews",
        "short": "Joint Base Andrews",
        "lat": 38.8109,
        "lon": -76.8669,
    },
]


def main(input_path: Path, boys_output: Path, anchors_output: Path):
    df = pd.read_csv(input_path)

    # Only map boys that successfully geocoded
    mapped = df[df["lat"].notna() & df["lon"].notna()].copy()
    print(f"Building GeoJSON for {len(mapped)} boys (out of {len(df)} total).")

    features = []
    for _, row in mapped.iterrows():
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(row["lon"]), float(row["lat"])],
            },
            "properties": {
                "id": str(row["inmate_no_resolved"]),
                "name": row["name"],
                "age": int(row["age"]) if pd.notna(row["age"]) else None,
                "address": row["address_clean"],
                "address_year": int(row["address_year"]) if pd.notna(row["address_year"]) else None,
                "more_recent_address": (
                    row["more_recent_address"]
                    if isinstance(row.get("more_recent_address"), str)
                    and row["more_recent_address"].strip()
                    else None
                ),
                "tooltip": row["tooltip"],
                "geocode_source": row["geocode_source"],
            },
        }
        features.append(feature)

    boys_geojson = {"type": "FeatureCollection", "features": features}
    boys_output.parent.mkdir(parents=True, exist_ok=True)
    boys_output.write_text(json.dumps(boys_geojson, indent=2))
    print(f"Wrote: {boys_output}")

    # Anchors
    anchor_features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [a["lon"], a["lat"]]},
            "properties": {k: v for k, v in a.items() if k not in ("lat", "lon")},
        }
        for a in ANCHORS
    ]
    anchors_geojson = {"type": "FeatureCollection", "features": anchor_features}
    anchors_output.write_text(json.dumps(anchors_geojson, indent=2))
    print(f"Wrote: {anchors_output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--boys-output", type=Path, required=True)
    parser.add_argument("--anchors-output", type=Path, required=True)
    args = parser.parse_args()
    main(args.input, args.boys_output, args.anchors_output)
