"""
Fetch flight data from SerpAPI Google Flights.

Saves raw JSON responses to a platform-aware temp directory, one file per
route x date combination. Prints the temp directory path on stdout so the
caller can pipe it to filter_flights.py.

Usage:
    python fetch_flights.py --dates 2026-05-09,2026-05-10 --routes IND-EWR,ORD-LGA
    python fetch_flights.py --dates 2026-05-09 --routes IND-EWR --airlines UA,DL --stops 1
    python fetch_flights.py --dates 2026-05-09 --routes IND-EWR --output-dir /tmp/x

Args:
    --airlines    Optional comma-separated IATA airline codes (e.g. UA,DL). Omit for any airline.
    --stops       Optional. 0=any (default), 1=nonstop only, 2=one-stop-max.

Auth:
    Reads SERPAPI_KEY from environment. Override with --api-key.
"""
import argparse
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINT = "https://serpapi.com/search"
BASE_PARAMS = {
    "engine": "google_flights",
    "type": "2",          # one-way
    "sort_by": "2",       # price
    "currency": "USD",
}


def default_output_dir() -> Path:
    base = Path(tempfile.gettempdir()) / "estack-flight-planner"
    base.mkdir(parents=True, exist_ok=True)
    return base


def fetch_one(api_key: str, dep: str, arr: str, date: str, out_path: Path,
              airlines: str = None, stops: str = None) -> int:
    params = {**BASE_PARAMS, "departure_id": dep, "arrival_id": arr,
              "outbound_date": date, "api_key": api_key}
    if airlines:
        params["include_airlines"] = airlines
    if stops and stops != "0":
        params["stops"] = stops
    url = f"{ENDPOINT}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = resp.read()
    out_path.write_bytes(data)
    return len(data)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dates", required=True, help="Comma-separated YYYY-MM-DD")
    p.add_argument("--routes", required=True, help="Comma-separated DEP-ARR (e.g. IND-EWR,ORD-LGA)")
    p.add_argument("--airlines", default=None,
                   help="Optional comma-separated IATA codes (e.g. UA,DL). Omit for any airline.")
    p.add_argument("--stops", default="0",
                   help="0=any (default), 1=nonstop only, 2=one-stop-max")
    p.add_argument("--output-dir", default=None, help="Override temp dir")
    p.add_argument("--api-key", default=None, help="SerpAPI key (else uses $SERPAPI_KEY)")
    args = p.parse_args()

    api_key = args.api_key or os.environ.get("SERPAPI_KEY")
    if not api_key:
        print("ERROR: provide --api-key or set SERPAPI_KEY env var", file=sys.stderr)
        return 2

    out_dir = Path(args.output_dir) if args.output_dir else default_output_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    dates = [d.strip() for d in args.dates.split(",") if d.strip()]
    routes = [tuple(r.strip().split("-")) for r in args.routes.split(",") if r.strip()]

    total = 0
    for dep, arr in routes:
        for date in dates:
            fname = out_dir / f"{dep}_{arr}_{date}.json"
            try:
                size = fetch_one(api_key, dep, arr, date, fname,
                                 airlines=args.airlines, stops=args.stops)
                print(f"  {dep}->{arr} {date}: {size} bytes", file=sys.stderr)
                total += 1
            except Exception as e:
                print(f"  {dep}->{arr} {date}: FAILED ({e})", file=sys.stderr)

    print(f"Fetched {total} files to:", file=sys.stderr)
    print(out_dir)  # stdout = the path, for piping
    return 0


if __name__ == "__main__":
    sys.exit(main())
