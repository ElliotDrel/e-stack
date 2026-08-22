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
    Reads SERPAPI_KEY from the environment, then ~/.e-stack/.env (the shared
    credential file for every e-stack skill). Override with --api-key.
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


def estack_env(name: str) -> str:
    """Read a credential the e-stack way: environment first, then ~/.e-stack/.env.

    One file holds the credentials for every e-stack skill rather than one file
    per skill, so a key two skills both need is stored once. Format is KEY=value
    per line; blank lines and lines starting with # are ignored, and surrounding
    quotes are stripped. A live environment variable always wins, so a one-off
    override works without editing the file.
    """
    live = os.environ.get(name)
    if live:
        return live
    path = Path.home() / ".e-stack" / ".env"
    try:
        if not path.exists():
            return ""
        found = ""
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() == name:
                # Last wins. Keys are appended, never overwritten, so a re-added
                # key leaves the stale line sitting above the live one.
                found = v.strip().strip('"').strip("'")
        return found
    except Exception:
        pass
    return ""


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

    api_key = args.api_key or estack_env("SERPAPI_KEY")
    if not api_key:
        print("ERROR: provide --api-key, set SERPAPI_KEY, or add it to ~/.e-stack/.env",
              file=sys.stderr)
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
