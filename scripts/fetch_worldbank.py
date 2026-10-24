#!/usr/bin/env python3
"""Fetch World Bank indicator data for the static GitHub Pages app.

No third-party packages are required. Existing cache files are preserved if an
individual API request fails, so a transient outage does not erase good data.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CURRENT_YEAR = datetime.now(timezone.utc).year
START_YEAR = 1960
INDICATORS = {
    "NY.GDP.MKTP.CD": "GDP (current US$)",
    "NY.GDP.MKTP.KD.ZG": "GDP growth (annual %)",
    "NY.GDP.PCAP.CD": "GDP per capita (current US$)",
    "SP.POP.TOTL": "Population, total",
    "FP.CPI.TOTL.ZG": "Inflation, consumer prices (annual %)",
}
BASE = "https://api.worldbank.org/v2"


def get_json(url: str, retries: int = 4, timeout: int = 35):
    last = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": "world-economy-time-machine/1.0"})
            with urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            if attempt + 1 < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"request failed after {retries} attempts: {url}: {last}")


def write_json(path: Path, data) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    tmp.replace(path)


def fetch_countries():
    url = f"{BASE}/country?" + urlencode({"format": "json", "per_page": 400})
    raw = get_json(url)
    rows = raw[1] if isinstance(raw, list) and len(raw) > 1 else []
    countries = []
    for x in rows:
        region = (x.get("region") or {}).get("value") or ""
        if not region or region == "Aggregates":
            continue
        countries.append({
            "iso3": x.get("id"),
            "iso2": x.get("iso2Code"),
            "name": x.get("name"),
            "region": region,
            "income": (x.get("incomeLevel") or {}).get("value") or "",
            "capital": x.get("capitalCity") or "",
            "longitude": x.get("longitude") or "",
            "latitude": x.get("latitude") or "",
        })
    countries = [c for c in countries if c["iso3"]]
    countries.sort(key=lambda c: c["iso3"])
    write_json(DATA_DIR / "countries.json", countries)
    return {c["iso3"] for c in countries}, len(countries)


def fetch_indicator(code: str, country_isos: set[str]):
    params = urlencode({
        "format": "json",
        "date": f"{START_YEAR}:{CURRENT_YEAR}",
        "per_page": 40000,
    })
    url = f"{BASE}/country/all/indicator/{code}?{params}"
    raw = get_json(url)
    meta = raw[0] if isinstance(raw, list) and raw else {}
    rows = raw[1] if isinstance(raw, list) and len(raw) > 1 else []
    series: dict[str, dict[str, float]] = {}
    aggregates: dict[str, dict[str, float]] = {}
    latest = START_YEAR
    points = 0
    for r in rows:
        iso = r.get("countryiso3code")
        date = r.get("date")
        value = r.get("value")
        if not iso or value is None or not date:
            continue
        try:
            year = int(date)
            value = float(value)
        except (TypeError, ValueError):
            continue
        latest = max(latest, year)
        target = series if iso in country_isos else aggregates
        target.setdefault(iso, {})[str(year)] = value
        points += 1
    payload = {
        "indicator": {
            "code": code,
            "name": INDICATORS[code],
            "source": "World Bank Indicators API",
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "api_meta": meta,
        "series": series,
        "aggregates": aggregates,
        "latest_year": latest,
        "points": points,
    }
    write_json(DATA_DIR / f"{code}.json", payload)
    return points, latest


def main() -> int:
    print("World Economy Time Machine data update")
    failures = []
    try:
        country_isos, count = fetch_countries()
        print(f"countries: {count}")
    except Exception as exc:
        failures.append(f"countries: {exc}")
        existing = DATA_DIR / "countries.json"
        if existing.exists():
            with existing.open(encoding="utf-8") as f:
                countries = json.load(f)
            country_isos = {c["iso3"] for c in countries if c.get("iso3")}
            print(f"countries: using existing cache ({len(country_isos)})")
        else:
            print("countries: no cache available", file=sys.stderr)
            return 1

    for code in INDICATORS:
        try:
            points, latest = fetch_indicator(code, country_isos)
            print(f"{code}: {points} points, latest {latest}")
        except Exception as exc:
            failures.append(f"{code}: {exc}")
            path = DATA_DIR / f"{code}.json"
            if path.exists():
                print(f"{code}: update failed; preserving existing cache", file=sys.stderr)
            else:
                print(f"{code}: update failed and no cache exists", file=sys.stderr)

    manifest = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "start_year": START_YEAR,
        "requested_through": CURRENT_YEAR,
        "indicators": list(INDICATORS),
        "failures": failures,
    }
    write_json(DATA_DIR / "manifest.json", manifest)
    if failures:
        print("Warnings:", *failures, sep="\n- ", file=sys.stderr)
    # Do not fail the deployment when at least some cached data is available.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
