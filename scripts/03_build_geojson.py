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
import re
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
        "name": "Unkempt grave site at Cheltenham",
        "short": "Unkempt grave site",
        "lat": 38.7347,
        "lon": -76.8349,
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


def expand_abbrevs(text):
    """Expand institution abbreviations; preserve state abbreviation 'Md.'"""
    text = re.sub(r"\bH\.\s*of\s*C\.?\b", "House of Correction", text)
    text = re.sub(r"(?:Md\.\s*|Maryland\s+)Pen\.?\b", "Maryland Penitentiary", text)
    text = re.sub(r"\bPen\.?\b", "Penitentiary", text)
    return text


def build_tooltip(row):
    name    = str(row["name"]).strip()
    age     = int(row["age"]) if pd.notna(row.get("age")) else None
    address = str(row["address_clean"]).strip() if pd.notna(row.get("address_clean")) else None
    if not address or address == "nan":
        address = None
    more = str(row["more_recent_address"]).strip() if pd.notna(row.get("more_recent_address")) else None
    if not more or more == "nan":
        more = None

    # Sentence 1 — name (bold) and age (bold)
    age_str = f"<strong>{age}</strong>" if age else "an unknown age"
    s1 = f"<strong>{name}</strong> was {age_str} at Cheltenham in 1938."

    # Sentence 2 — last known address before commitment
    s2 = f"He lived at {address} before his commitment." if address else ""

    # Sentence 3 — what happened next
    s3 = ""
    if more:
        expanded = expand_abbrevs(more)
        lower    = expanded.lower()
        years    = re.findall(r"\b(19\d{2})\b", expanded)
        year     = years[-1] if years else ""

        if "killed" in lower:
            s3 = f"He was killed in {year}." if year else "He was killed."

        elif "died" in lower:
            s3 = f"He died in {year}." if year else "He died."

        elif "crownsville" in lower:
            s3 = (
                f"By {year}, he had been committed to Crownsville State Hospital."
                if year else
                "He was later committed to Crownsville State Hospital."
            )

        elif "henryton" in lower:
            s3 = (
                f"By {year}, he had been committed to Henryton State Hospital."
                if year else
                "He was later committed to Henryton State Hospital."
            )

        elif "army detention" in lower:
            dur = re.search(r"\((\d+\s*years?)\)", expanded, re.I)
            dur_str = f" ({dur.group(1)})" if dur else ""
            s3 = (
                f"By {year}, he was serving Army detention{dur_str}."
                if year else
                f"He was sentenced to Army detention{dur_str}."
            )

        elif "house of correction" in lower:
            s3 = (
                f"By {year}, he was at the House of Correction."
                if year else
                "He was later sent to the House of Correction."
            )

        elif "maryland penitentiary" in lower:
            dur = re.search(r"\((\d+\s*years?)\)", expanded, re.I)
            dur_str = f" ({dur.group(1)})" if dur else ""
            s3 = (
                f"By {year}, he was at the Maryland Penitentiary{dur_str}."
                if year else
                f"He was later sent to the Maryland Penitentiary{dur_str}."
            )

        else:
            # Later address — strip all years then clean up stray punctuation
            addr_part = re.sub(r"\s*\b19\d{2}\b\s*", " ", expanded)
            addr_part = re.sub(r"\(\s+\)", "", addr_part)
            addr_part = re.sub(r"\s+", " ", addr_part).strip().rstrip(" -–,.;(")
            # Close any unclosed parenthesis
            if addr_part.count("(") > addr_part.count(")"):
                addr_part += ")"
            if addr_part and year:
                s3 = f"By {year}, he was living at {addr_part}."
            elif addr_part:
                s3 = f"He was later living at {addr_part}."

    return " ".join(p for p in [s1, s2, s3] if p)


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
                "tooltip": build_tooltip(row),
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
