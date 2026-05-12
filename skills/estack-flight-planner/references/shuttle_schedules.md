# Shuttle Schedules — Template & Format Reference

This skill optionally pairs flights with a ground shuttle service. Pairing is **off by default** — the skill only runs it if the user's config has a `shuttle_service` block set.

This file describes:
1. How to configure your shuttle service in `~/.flight-planner/config.json`
2. The JSON format the pairing script (`scripts/pair_shuttles.py`) expects
3. How the skill builds that JSON from your shuttle company's website each run

## 1. Config block

Add this to `~/.flight-planner/config.json` if you regularly use a shuttle:

```json
"shuttle_service": {
  "name": "Acme Airport Express",
  "schedule_urls": [
    "https://acmeairport.example.com/schedules/ord",
    "https://acmeairport.example.com/schedules/mdw"
  ],
  "costs": {
    "ORD": 60,
    "MDW": 55
  },
  "home_timezone": "America/New_York",
  "airport_timezones": {
    "ORD": "America/Chicago",
    "MDW": "America/Chicago"
  }
}
```

**Fields:**

- `name` — display name for the company
- `schedule_urls` — one or more URLs the skill will fetch with WebFetch each run. Should be public schedule pages.
- `costs` — one-way USD cost per destination airport (IATA code)
- `home_timezone` — IANA timezone string for the city/town the shuttle picks you up from
- `airport_timezones` — IANA timezone string per destination airport

Set `shuttle_service: null` (or omit the field entirely) if you don't use a shuttle.

## 2. JSON the pairing script expects

After fetching schedule URLs, the skill assembles this JSON and saves it as `shuttles.json`:

```json
{
  "shuttles": [
    {
      "company": "Acme Airport Express",
      "from": "Home",
      "to": "ORD",
      "pickup_location": "Downtown station",
      "departs_local": "06:00",
      "arrives_local": "08:30"
    },
    {
      "company": "Acme Airport Express",
      "from": "Home",
      "to": "ORD",
      "pickup_location": "Downtown station",
      "departs_local": "10:00",
      "arrives_local": "12:30"
    }
  ]
}
```

**Field rules:**

- `from` — descriptive label for the pickup region (not used for matching)
- `to` — destination airport IATA code (used to match flights)
- `departs_local` — pickup time in **home timezone**, HH:MM 24-hour
- `arrives_local` — arrival time in **destination airport's local timezone**, HH:MM 24-hour
- `pickup_location` — optional, shown in output

The pairing script uses `--tz-offsets` to translate `arrives_local` into the home timezone for buffer math. The skill computes those offsets from `home_timezone` and `airport_timezones` in your config.

## 3. Extracting schedules from a website

Most shuttle companies post fixed weekly schedules on their site. To turn a schedule page into the JSON above:

1. Use WebFetch on each URL in `schedule_urls`. Prompt: "extract every shuttle run with pickup time, destination airport, and arrival time."
2. For each run, build one object with `from`, `to`, `departs_local`, `arrives_local`.
3. Append all objects to a single `"shuttles"` array.

If the company has multiple runs to the same airport on different days, treat each as a separate entry. If schedules change on weekends, fetch the relevant day's schedule when the user's flight date is a weekend.

## 4. Cost overrides for a single run

If the user wants to override shuttle costs for one run only (e.g., a friend is driving them for free), the skill passes `--shuttle-costs "ORD:0"` instead of the config value. This doesn't modify the saved config.

## 5. Tightness tuning

`--min-buffer-min` (default 90) sets the floor for "viable" — flights with less buffer than this between shuttle arrival and flight departure are marked TOO_TIGHT. Increase to 120 if your airport has long security lines, decrease to 60 if you trust your shuttle and have TSA PreCheck.

`--max-wait-min` (default 240) caps how much pre-flight wait time is acceptable. Pairings beyond this get a LONG_WAIT label but still appear in the output.
