# Shuttle Schedules — Template & Format Reference

This skill optionally pairs flights with a ground shuttle service on **either end** of the trip. Pairing is **off by default** — it only runs if the user's config has a `shuttle_service` block set.

Two legs exist, and both can apply to the same itinerary:

| Leg | `direction` | What it does | Buffer rule |
|---|---|---|---|
| Pre-flight | `to_airport` | home → departure airport | shuttle must **arrive** at least `min_buffer_min` before the flight departs |
| Post-flight | `from_airport` | arrival airport → home | shuttle must **depart** at least `min_connect_min` after the flight lands |

A user who lives near one airport and flies in and out of it needs entries in both directions. Fetching only the outbound schedule is the single most common way to end up with a table that silently drops every flight.

This file describes:
1. How to configure the shuttle service in `~/.flight-planner/config.json`
2. The JSON format `scripts/pair_shuttles.py` expects
3. How the skill builds that JSON from the shuttle company's website each run

## 1. Config block

```json
"shuttle_service": {
  "home_label": "Home town",
  "home_timezone": "America/New_York",
  "providers": [
    {
      "name": "Acme Airport Express",
      "schedule_urls": [
        "https://acmeairport.example.com/schedules/ord",
        "https://acmeairport.example.com/schedules/mdw"
      ],
      "airports": ["ORD", "MDW"]
    }
  ],
  "costs": { "ORD": 60, "MDW": 55 },
  "airport_timezones": { "ORD": "America/Chicago", "MDW": "America/Chicago" },
  "min_buffer_min": 90,
  "min_connect_min": 60,
  "max_wait_min": 240,
  "reservation_lead_hours": 24
}
```

**Fields:**

- `home_label` — display name for the pickup/dropoff town
- `providers` — one entry per shuttle company. Multiple companies serving the same airport is normal and supported; the pairing script picks whichever run fits best regardless of who operates it.
  - `name` — company display name
  - `schedule_urls` — public schedule pages the skill fetches with WebFetch each run
  - `airports` — IATA codes this company serves
- `costs` — one-way USD per airport, charged once per shuttle leg used (a trip with both a pre- and post-flight shuttle is charged twice)
- `airport_timezones` — IANA zone per airport. Informational; the buffer math does not need it (see "Timezones" below), but it's useful when reading a schedule page that lists times in a single zone.
- `min_buffer_min` — pre-flight floor. Default 90. Raise to 120 for airports with long security lines, drop to 60 with PreCheck and a shuttle you trust.
- `min_connect_min` — post-flight floor: how long after landing before the user can realistically be at the shuttle stop. Default 60. Raise it if they check bags.
- `max_wait_min` — above this, a pairing is labeled a long wait but still shown. Default 240.
- `reservation_lead_hours` — how much notice the company requires. If set, the skill passes `--now` and `--reservation-lead-hours` so pairings inside the cutoff get flagged.

Set `shuttle_service: null` (or omit it) if the user has no shuttle.

**Legacy single-provider form** (still read correctly): a flat `"name"` + `"schedule_urls"` at the top level instead of a `providers` array.

## 2. JSON the pairing script expects

After fetching the schedule URLs, assemble this and save it as `shuttles.json`:

```json
{
  "shuttles": [
    {
      "company": "Acme Airport Express",
      "airport": "ORD",
      "direction": "to_airport",
      "stop": "Downtown station",
      "departs_local": "06:00",
      "arrives_local": "08:30",
      "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]
    },
    {
      "company": "Acme Airport Express",
      "airport": "ORD",
      "direction": "from_airport",
      "stop": "Terminal 2, door 3E",
      "departs_local": "19:00",
      "arrives_local": "21:30"
    }
  ]
}
```

**Field rules:**

- `airport` — IATA code, required. This is what matches the flight.
- `direction` — `"to_airport"` or `"from_airport"`, required.
- `departs_local` / `arrives_local` — HH:MM 24-hour. **Each time is local to the place that event happens.** A `to_airport` run departs in home time and arrives in airport time; a `from_airport` run departs in airport time and arrives in home time.
- `stop` — optional pickup/dropoff point, shown in the output table.
- `days` — optional list of operating weekdays (`"Mon"` or `"Monday"`, any case). Omit for daily service. Weekend schedules usually differ — capture them.
- `company` — optional but recommended; shown in the output.

One object per run. If a company runs 9 times a day to one airport, that's 9 objects.

**Older schema still accepted:** `{"from": "Home", "to": "ORD", "departs_et": "...", "arrives_local": "..."}`. The script infers `airport`/`direction` from whichever of `from`/`to` looks like an IATA code. Entries where neither side is an IATA code are a hard error, not a silent skip.

## 3. Timezones

The buffer math never converts timezones, and it doesn't need to. It only ever compares the **airport-side** shuttle time against the flight time, and SerpAPI reports flight times in the airport's own local zone — so both sides are already in the same frame.

`--tz-offsets` from earlier versions is accepted and ignored (it applied the same offset to both sides of the subtraction, so it always cancelled out).

Overnight runs are handled by testing the adjacent calendar day, so a 23:40 landing can pair with a 01:00 departure the next morning.

## 4. Extracting schedules from a website

1. WebFetch each URL in every provider's `schedule_urls`. Prompt: *"extract every shuttle run in both directions — town to airport and airport to town — with departure time, arrival time, destination airport, pickup/dropoff stop, and which days it operates."*
2. Build one object per run per direction.
3. If the site only shows one direction, fetch the return page too, or ask the user. **Do not** assume the return schedule mirrors the outbound one.
4. If weekend schedules differ and the trip falls on a weekend, capture the weekend runs and set `days` on each entry.

## 5. Per-run overrides

Cost override for a single search (a friend is driving, one way is free): pass `--shuttle-costs "ORD:0"` instead of the config value. Never write the override to the config.

Tightness override: `--min-buffer-min` / `--min-connect-min` / `--max-wait-min` on the command line beat the config values for that run.

`--max-gap-min` (default 720) is the hard ceiling — a shuttle run further than this from the flight is not treated as a pairing at all, which is what stops "your shuttle is 22 hours later" from showing up as an option.

## 6. What the labels mean

| Label | Meaning |
|---|---|
| comfortable | Buffer sits between the floor + 30 min and the floor + 90 min |
| comfortable, longer wait | Above floor + 90 min but still under `max_wait_min` |
| tight | Within 30 min of the floor — works only if the shuttle is on time |
| long wait | Over `max_wait_min` |
| TOO TIGHT | Under the floor. Shown, ranked last, and never recommended. |
