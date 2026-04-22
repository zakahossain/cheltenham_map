"""
Clean the 1938 Cheltenham list CSV.

Operations:
  - Parse year from Address and More Recent Address fields
  - Strip years from address text to get clean address
  - Flag Baltimore-city candidates for geocoding
  - Handle the 4 duplicate inmate number cases per project decisions:
      6637 Levin Walker  → merge (keep most detailed)
      6658 Potter/Schofield → merge (aliases, keep most detailed)
      6670 Hamilton & Johnson → split into 6670a / 6670b (different boys)
      6702 Russell/Daugherty → merge (true duplicate)
  - Build the final tooltip string per boy

Run:
    python scripts/01_clean.py \
        --input  data/cheltenham_list_1938.csv \
        --output data/01_boys_cleaned.csv
"""
import argparse
import re
from pathlib import Path

import pandas as pd

NON_BALTIMORE_KEYWORDS = [
    "Annapolis", "Frederick", "Cumberland", "Hagerstown", "Salisbury",
    "Cambridge", "Elkton", "Crisfield", "Hyattsville", "Washington",
    "Catonsville", "Towson", "Snow Hill", "Pocomoke", "Henryton",
    "Crownsville", "Cooksville", "La Plata", "Bladensburg",
    "Seat Pleasant", "Rosaryville", "Williamsport", "Monkton", "Vanbibber",
    "Mayo", "Marion", "Pomfret", "Ridgely", "Lusby", "Frostburg",
    "Cedar Hghts", "Centreville", "Church Hill", "Princess Anne",
    "Co.", "County",
]

YEAR_RE = re.compile(r"\b(19[2-4]\d)\b")


def extract_year(text: str):
    if pd.isna(text):
        return None
    m = YEAR_RE.search(str(text))
    return int(m.group(1)) if m else None


def strip_year(text: str) -> str:
    """Remove trailing year and dangling punctuation from an address string."""
    if pd.isna(text):
        return ""
    cleaned = YEAR_RE.sub("", str(text))
    # strip trailing dashes, spaces, commas from year removal
    cleaned = re.sub(r"[\s\-,]+$", "", cleaned).strip()
    return cleaned


def is_baltimore_candidate(addr: str) -> bool:
    """True if address looks like a Baltimore city street address."""
    if pd.isna(addr):
        return False
    s = str(addr)
    if any(k.lower() in s.lower() for k in NON_BALTIMORE_KEYWORDS):
        return False
    # needs a street number + street-name pattern
    return bool(re.search(r"\b\d+[½]?\s+[NSEW]?\.?\s*[A-Za-z]", s))


def _clean_trailing_punct(s: str) -> str:
    """
    Strip stray trailing dashes, commas, whitespace — but preserve a single
    trailing period that belongs to an abbreviation (St., Ave., Pl., Ct., N.W., etc.).
    """
    if not s:
        return s
    s = re.sub(r"[\s\-,]+$", "", s)
    # if it ends with ".." strip one
    s = re.sub(r"\.\.+$", ".", s)
    return s


def build_tooltip(row) -> str:
    """
    Build the tooltip per the approved format:

        'William Brown, age 17 at Cheltenham (1938). Last known address:
         306 N. Poppleton St. (1934).'
    """
    parts = []
    parts.append(f"{row['name']}, age {row['age']} at Cheltenham (1938).")

    addr = _clean_trailing_punct(row["address_clean"])
    yr = row["address_year"]
    if addr:
        if pd.notna(yr) and yr is not None:
            # If address already ends with ".", no double period; else add comma-year style
            sep = "" if addr.endswith(".") else ""
            parts.append(f"Last known address: {addr}{sep} ({int(yr)}).")
        else:
            # Ensure the sentence ends with a period — if address already ends
            # in "." (abbreviation), don't double up.
            end = "" if addr.endswith(".") else "."
            parts.append(f"Last known address: {addr}{end}")

    later = row.get("more_recent_address")
    if isinstance(later, str) and later.strip():
        # clean up " - " separators & trailing junk
        later_clean = _clean_trailing_punct(later.strip())
        later_clean = re.sub(r"\s*-\s*(\d{4})", r" \1", later_clean)
        parts.append(f"Later: {later_clean}.")

    return " ".join(parts)


# ---- duplicate handling ------------------------------------------------------

def resolve_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Per project decisions:
      6637 — merge (keep most detailed address/year, concat later-address info)
      6658 — merge (aliases for same boy)
      6670 — SPLIT into 6670a (Hamilton) and 6670b (Johnson); they are two
             different boys recorded under the same number
      6702 — merge (true duplicate entry)
    """
    df = df.copy()
    df["inmate_no_resolved"] = df["inmate_no"].astype(str)

    # 6670 split
    mask_hamilton = (df["inmate_no"] == 6670) & (
        df["name"].str.contains("Hamilton", case=False, na=False)
    )
    mask_johnson = (df["inmate_no"] == 6670) & (
        df["name"].str.contains("Johnson", case=False, na=False)
    )
    df.loc[mask_hamilton, "inmate_no_resolved"] = "6670a"
    df.loc[mask_johnson, "inmate_no_resolved"] = "6670b"

    # Consolidate exact-duplicate pairs by keeping the richer row
    def richness_score(row):
        score = 0
        if pd.notna(row["address_year"]):
            score += 2
        if isinstance(row["address_clean"], str) and len(row["address_clean"]) > 0:
            score += len(row["address_clean"])
        if isinstance(row.get("more_recent_address"), str):
            score += 5
        return score

    df["_score"] = df.apply(richness_score, axis=1)

    dedup_rows = []
    for inmate_no, group in df.groupby("inmate_no_resolved", sort=False):
        if len(group) == 1:
            dedup_rows.append(group.iloc[0])
            continue
        # For merged duplicates, pick the richest row and merge later-address
        best = group.sort_values("_score", ascending=False).iloc[0].copy()
        later_vals = [
            str(x).strip()
            for x in group["more_recent_address"].dropna()
            if str(x).strip()
        ]
        if later_vals:
            best["more_recent_address"] = " | ".join(sorted(set(later_vals)))
        # Collect alternate names (aliases like "George Harry Potter or George Schofield")
        names = list(group["name"].unique())
        if len(names) > 1:
            best["name_aliases"] = " / ".join(names[1:])
        dedup_rows.append(best)

    out = pd.DataFrame(dedup_rows).drop(columns=["_score"])
    return out


# ---- main --------------------------------------------------------------------

def main(input_path: Path, output_path: Path):
    df = pd.read_csv(input_path)
    df = df.dropna(axis=1, how="all")
    df = df.rename(
        columns={
            "Reporter": "reporter",
            "Name": "name",
            "No.": "inmate_no",
            "Age": "age",
            "Address": "address_raw",
            "More Recent Address": "more_recent_address",
        }
    )
    df = df.dropna(subset=["name"]).reset_index(drop=True)

    df["address_year"] = df["address_raw"].apply(extract_year)
    df["address_clean"] = df["address_raw"].apply(strip_year)
    df["more_recent_year"] = df["more_recent_address"].apply(extract_year)
    df["baltimore_candidate"] = df["address_clean"].apply(is_baltimore_candidate)
    df["name_aliases"] = ""

    df = resolve_duplicates(df)

    # Final tooltip
    df["tooltip"] = df.apply(build_tooltip, axis=1)

    # Build the geocoding query — append ", Baltimore, MD" to likely-Baltimore rows
    def geocode_query(row):
        if not row["address_clean"]:
            return ""
        if row["baltimore_candidate"]:
            return f"{row['address_clean']}, Baltimore, MD"
        return row["address_clean"]

    df["geocode_query"] = df.apply(geocode_query, axis=1)

    # Keep only the Baltimore candidates in the map-ready subset,
    # but write a full file too so nothing is lost.
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cols_out = [
        "inmate_no_resolved", "name", "name_aliases", "age", "reporter",
        "address_raw", "address_clean", "address_year",
        "more_recent_address", "more_recent_year",
        "baltimore_candidate", "geocode_query", "tooltip",
    ]
    df[cols_out].to_csv(output_path, index=False)

    # Also write a Baltimore-only file for geocoding
    balt = df[df["baltimore_candidate"]].copy()
    balt_path = output_path.parent / "01_boys_baltimore_only.csv"
    balt[cols_out].to_csv(balt_path, index=False)

    # Summary
    print(f"Input rows:                 {len(pd.read_csv(input_path))}")
    print(f"After dedup:                {len(df)}")
    print(f"Baltimore candidates:       {df['baltimore_candidate'].sum()}")
    print(f"Non-Baltimore (MD counties, DC, etc.): {(~df['baltimore_candidate']).sum()}")
    print()
    print(f"Wrote: {output_path}")
    print(f"Wrote: {balt_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    main(args.input, args.output)
