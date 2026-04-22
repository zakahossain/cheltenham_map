"""
Geocode cleaned Baltimore addresses.

Strategy:
  1. US Census Geocoder (primary) — free, no key, excellent for US street addresses
     https://geocoding.geo.census.gov/geocoder/
  2. Nominatim / OpenStreetMap (fallback) — free, requires polite rate limiting
     https://nominatim.org/release-docs/develop/api/Search/

Historical addresses (1930s) may have been demolished, renumbered, or lost to
urban renewal. Accept that some will fail. The script records the failures so
you can inspect and possibly geocode them manually (Google Maps, historical atlases).

Run:
    python scripts/02_geocode.py \
        --input  data/01_boys_baltimore_only.csv \
        --output data/02_boys_geocoded.csv

Requires:
    pip install pandas requests tenacity
"""
import argparse
import time
from pathlib import Path

import pandas as pd
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "cheltenham-journalism-project/1.0 (journalism research; contact advisor)"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def geocode_census(address: str):
    """Try the US Census Geocoder. Returns (lat, lon) or None."""
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "format": "json",
    }
    r = requests.get(CENSUS_URL, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    matches = data.get("result", {}).get("addressMatches", [])
    if not matches:
        return None
    coords = matches[0]["coordinates"]
    return (coords["y"], coords["x"])  # (lat, lon)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def geocode_nominatim(address: str):
    """Fallback: OpenStreetMap Nominatim. Returns (lat, lon) or None."""
    params = {
        "q": address,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    headers = {"User-Agent": USER_AGENT}
    r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=15)
    r.raise_for_status()
    results = r.json()
    if not results:
        return None
    return (float(results[0]["lat"]), float(results[0]["lon"]))


def geocode_one(address: str):
    """Try Census first, Nominatim second. Returns (lat, lon, source) or (None, None, 'failed')."""
    try:
        result = geocode_census(address)
        if result:
            return (*result, "census")
    except Exception as e:
        print(f"    Census error: {e}")

    time.sleep(1.1)  # polite rate limit for Nominatim

    try:
        result = geocode_nominatim(address)
        if result:
            return (*result, "nominatim")
    except Exception as e:
        print(f"    Nominatim error: {e}")

    return (None, None, "failed")


def main(input_path: Path, output_path: Path):
    df = pd.read_csv(input_path)
    print(f"Geocoding {len(df)} addresses...")

    latitudes, longitudes, sources = [], [], []
    for i, row in df.iterrows():
        query = row["geocode_query"]
        print(f"  [{i+1}/{len(df)}] {query[:60]}")
        if not isinstance(query, str) or not query.strip():
            latitudes.append(None)
            longitudes.append(None)
            sources.append("skipped")
            continue
        lat, lon, src = geocode_one(query)
        latitudes.append(lat)
        longitudes.append(lon)
        sources.append(src)
        if src == "failed":
            print(f"    ⚠ FAILED: {query}")

    df["lat"] = latitudes
    df["lon"] = longitudes
    df["geocode_source"] = sources

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    # Summary
    success = df[df["geocode_source"].isin(["census", "nominatim"])]
    failed = df[df["geocode_source"] == "failed"]
    print()
    print("=" * 60)
    print(f"GEOCODING RESULTS")
    print(f"  Total:          {len(df)}")
    print(f"  Census hits:    {(df['geocode_source'] == 'census').sum()}")
    print(f"  Nominatim hits: {(df['geocode_source'] == 'nominatim').sum()}")
    print(f"  Failed:         {len(failed)}")
    print("=" * 60)

    if len(failed) > 0:
        fail_path = output_path.parent / "02_geocoding_failures.csv"
        failed[["inmate_no_resolved", "name", "address_clean", "geocode_query"]].to_csv(
            fail_path, index=False
        )
        print(f"\nFailures saved to {fail_path} for manual geocoding")

    print(f"\nWrote: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    main(args.input, args.output)
