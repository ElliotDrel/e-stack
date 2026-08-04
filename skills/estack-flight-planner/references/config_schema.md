# Config Schema — `~/.flight-planner/config.json`

The skill stores user preferences in this file. It lives outside `~/.agents/skills/` so the e-stack installer never overwrites it.

`~` expands to `%USERPROFILE%` on Windows and `$HOME` on Mac/Linux.

## Full schema

```json
{
  "serpapi_key": "abc123 or null",

  "budget_usd": 200,
  "budget_strength": "soft",

  "airline_preferences": ["UA", "DL"],
  "airline_preference_strength": "soft",

  "nonstop_preference": "preferred",
  "nonstop_strength": "soft",

  "time_priority_bands": ["11:00-14:00", "14:00-22:00"],
  "time_priority_strength": "soft",

  "max_duration_min": null,
  "max_duration_strength": "soft",

  "home_airport": null,
  "frequent_destinations": [],

  "trip_presets": {},
  "shuttle_service": null
}
```

## Field reference

### `serpapi_key`
- Type: string or null
- SerpAPI key for Google Flights queries. If null, the skill falls back to WebSearch (less comprehensive — see SKILL.md).
- Get one at https://serpapi.com/manage-api-key.

### `budget_usd`
- Type: int — max flight price in USD.

### `budget_strength`
- Type: `"hard"` or `"soft"`
- `hard` = filter out flights above budget. `soft` = include them but rank cheaper ones higher.

### `airline_preferences`
- Type: array of IATA airline codes (e.g. `["UA", "DL"]`). Empty array = any airline.
- A connecting itinerary counts as matching only if **every** leg is on a preferred airline.

### `airline_preference_strength`
- Type: `"hard"` or `"soft"`

### `nonstop_preference`
- Type: `"required"`, `"preferred"`, or `"no_preference"`

### `nonstop_strength`
- Type: `"hard"` or `"soft"`
  - `required` + `hard` = filter out anything with stops
  - `required` + `soft` = treat stopovers as a downside but still show them
  - `preferred` + `soft` = rank nonstops first, show stops second (typical setup)
  - `no_preference` = strength is ignored

### `time_priority_bands`
- Type: array of `"HH:MM-HH:MM"` ranges in 24-hour time.
- Departures inside the first band rank highest; second band second; outside all bands lowest.

### `time_priority_strength`
- Type: `"hard"` or `"soft"`

### `max_duration_min`
- Type: int or null — cap on total itinerary minutes (gate + gate, layovers included).
- Useful when `nonstop_preference` is `soft`: it lets one-stops through without letting a 14-hour triple-connection through with them.

### `max_duration_strength`
- Type: `"hard"` or `"soft"`

### `home_airport`
- Type: IATA code or null. Suggested as the origin in Phase 1 (but the skill still asks).

### `frequent_destinations`
- Type: array of IATA codes. Surfaced as suggestions when asking for a destination.

### `trip_presets`
- Type: object mapping a short slug to a saved route. **This is the fast path** — when the user names a preset (or says something that clearly matches its `aliases`), the skill skips airport research entirely and goes straight to confirming dates.

```json
"trip_presets": {
  "home-to-school": {
    "label": "NJ -> Purdue",
    "aliases": ["to school", "back to campus", "nj to purdue"],
    "origins": ["EWR", "LGA", "JFK"],
    "destinations": ["IND", "ORD"],
    "shuttle_legs": "arrival",
    "notes": "IND drops me 1h from campus; ORD is 2.5h but usually cheaper."
  },
  "school-to-home": {
    "label": "Purdue -> NJ",
    "aliases": ["home", "back to nj", "purdue to nj"],
    "origins": ["IND", "ORD"],
    "destinations": ["EWR", "LGA", "JFK"],
    "shuttle_legs": "departure"
  }
}
```

Per-preset fields, all optional except `origins`/`destinations`:

| Field | Purpose |
|---|---|
| `label` | Human-readable direction, shown when confirming |
| `aliases` | Phrases that should match this preset in Phase 1 |
| `origins` / `destinations` | IATA lists passed straight to `--routes` / `--from` / `--to` |
| `routes` | Optional explicit `["EWR-IND", "EWR-ORD"]` list, when the full cross-product isn't wanted |
| `shuttle_legs` | Which end of *this* direction normally needs a ride: `"departure"`, `"arrival"`, `"both"`, or `"none"`. See below. |
| `notes` | Free text shown to the user during confirmation |
| Any preference key | Per-preset override of a top-level preference (e.g. a higher `budget_usd` for a long route) |

### `shuttle_legs` — a default, never an assumption

A configured shuttle does not mean a needed shuttle. Someone flying out of a hub near where they live needs no ride on the home end, and someone who normally rides might be getting dropped off, driving, or stopping somewhere on the way this time.

`shuttle_legs` records which end of a given direction *usually* needs one, so the skill proposes the right thing instead of pairing a shuttle to an airport where the user has a car. It maps to `pair_shuttles.py --legs`:

| Value | Meaning | `--legs` |
|---|---|---|
| `"departure"` | Ride from home to the departure airport | `pre` |
| `"arrival"` | Land, then ride to the destination | `post` |
| `"both"` | Ride on both ends | `both` |
| `"none"` | No ground shuttle for this direction; skip pairing entirely | (skip) |

Note that it's direction-specific and usually asymmetric. The same person flying NJ → Purdue needs a ride only on arrival; flying Purdue → NJ they need one only on departure. Two presets, two different values.

**The skill must still confirm it out loud every run.** It appears as its own line in the Phase 2 confirmation block, not folded into a general "still your prefs?" yes. A wrong guess here never surfaces as an error — it just quietly ranks every option around a cost that was never going to be paid.

A preset never bypasses confirmation — the skill still shows the resolved plan and waits for a yes. It only removes the research step.

### `shuttle_service`
- Type: object or null. If non-null, the skill pairs flights with ground shuttle runs on either end. Full sub-schema in `references/shuttle_schedules.md`.

## Example configs

### Frequent flier, one home airport, picky about times

```json
{
  "serpapi_key": "sk_xxx",
  "budget_usd": 350,
  "budget_strength": "soft",
  "airline_preferences": ["DL"],
  "airline_preference_strength": "hard",
  "nonstop_preference": "required",
  "nonstop_strength": "hard",
  "time_priority_bands": ["07:00-10:00", "17:00-20:00"],
  "time_priority_strength": "soft",
  "max_duration_min": null,
  "max_duration_strength": "soft",
  "home_airport": "JFK",
  "frequent_destinations": ["LAX", "SFO", "SEA"],
  "trip_presets": {},
  "shuttle_service": null
}
```

### Casual traveler, cost-sensitive, flexible

```json
{
  "serpapi_key": null,
  "budget_usd": 250,
  "budget_strength": "hard",
  "airline_preferences": [],
  "airline_preference_strength": "soft",
  "nonstop_preference": "preferred",
  "nonstop_strength": "soft",
  "time_priority_bands": [],
  "time_priority_strength": "soft",
  "max_duration_min": 600,
  "max_duration_strength": "soft",
  "home_airport": null,
  "frequent_destinations": [],
  "trip_presets": {},
  "shuttle_service": null
}
```

### Student flying a fixed route both ways, with a shuttle at the campus end

```json
{
  "serpapi_key": "sk_xxx",
  "budget_usd": 200,
  "budget_strength": "soft",
  "airline_preferences": [],
  "airline_preference_strength": "soft",
  "nonstop_preference": "preferred",
  "nonstop_strength": "soft",
  "time_priority_bands": ["11:00-14:00", "14:00-22:00"],
  "time_priority_strength": "soft",
  "max_duration_min": 480,
  "max_duration_strength": "soft",
  "home_airport": null,
  "frequent_destinations": ["EWR", "IND", "ORD"],
  "trip_presets": {
    "home-to-school": {
      "label": "NJ -> Purdue",
      "aliases": ["to school", "to purdue"],
      "origins": ["EWR", "LGA", "JFK"],
      "destinations": ["IND", "ORD"]
    },
    "school-to-home": {
      "label": "Purdue -> NJ",
      "aliases": ["home", "to nj"],
      "origins": ["IND", "ORD"],
      "destinations": ["EWR", "LGA", "JFK"]
    }
  },
  "shuttle_service": {
    "home_label": "West Lafayette / Purdue",
    "home_timezone": "America/New_York",
    "providers": [
      {"name": "Campus Shuttle Co", "airports": ["IND", "ORD"],
       "schedule_urls": ["https://example.com/schedule"]}
    ],
    "costs": {"IND": 30, "ORD": 60},
    "airport_timezones": {"IND": "America/New_York", "ORD": "America/Chicago"},
    "min_buffer_min": 90,
    "min_connect_min": 60,
    "max_wait_min": 240,
    "reservation_lead_hours": 24
  }
}
```

## Strength semantics recap

| Strength | Behavior |
|---|---|
| `hard` | Filter applied strictly — non-matching flights are excluded from output |
| `soft` | Filter applied as a rank weight — non-matching flights still shown, flagged with `soft_filter_violations` and sorted below matching ones |

When hard filters return zero results, the skill runs `filter_flights.py --cluster-analysis` to see which constraint(s) eliminated which flight counts, then proposes specific relaxations.
