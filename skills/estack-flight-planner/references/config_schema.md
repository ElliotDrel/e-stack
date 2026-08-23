# Config Schema — `~/.e-stack/estack-flight-planner/config.json`

The skill stores user preferences in this file. It lives outside `~/.agents/skills/` so the e-stack installer never overwrites it.

`~` expands to `%USERPROFILE%` on Windows and `$HOME` on Mac/Linux.

## Full schema

```json
{
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

  "default_party": "1a",
  "compare_parties": null,

  "trip_presets": {},
  "shuttle_service": null
}
```

## Field reference

### `serpapi_key` — removed
- **Credentials no longer live in this file.** The SerpAPI key goes in `~/.e-stack/.env` as `SERPAPI_KEY=<key>`, the one credential file every e-stack skill reads. Append to it; never overwrite it.
- Nothing reads `serpapi_key` from `config.json`. If your config still has the field, move the value to `~/.e-stack/.env` and delete it here — the setup check flags it.
- With no key anywhere, the skill falls back to WebSearch (less comprehensive — see SKILL.md). Get one at https://serpapi.com/manage-api-key.

### `budget_usd`
- Type: int — max flight price in USD, **per seat**. `filter_flights.py` compares it against `price_per_seat`, so the number means the same thing whether one person is flying or four.

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

### `default_party`

Who normally flies, as a party spec. This answers "how many seats am I buying" when nothing more specific applies, so a solo traveller sets `"1a"` once and never thinks about it again, and a family of five sets `"2a3c"` and gets family pricing on every search without re-stating it.

| Spec | Means |
|---|---|
| `1a` | one adult |
| `2a` | two adults |
| `2a3c` | two adults, three children |
| `1a1l` | one adult, one lap infant |

Letters are `a` adults, `c` children, `i` infants in their own seat, `l` infants on a lap. Order does not matter (`1c2a` reads as `2a1c`). A bare number means adults, so `"2"` and `"2a"` are the same thing. A party with no adults is a hard error.

**A lap infant is a passenger but not a seat.** Per-seat prices divide by seats, and a shuttle sells one ticket per rider who occupies a seat, so a lap infant never dilutes a per-seat number and never adds a shuttle fare.

Defaults to `"1a"` when absent.

### `compare_parties`

Party specs to price side by side, so the output shows what each seat costs at each party size rather than one number. Set it when the party is genuinely undecided — a trip someone might take alone or with a partner — and leave it `null` when it is not.

```json
"compare_parties": ["1a", "2a"]
```

Each spec is its own SerpAPI call, so a two-entry list doubles the quota a search costs. That is the whole cost, and it buys two things worth knowing:

- **Per-seat price moves with party size.** Airlines release seats in fare buckets. When the cheap bucket has one seat left, a 2-seat booking pushes both into the next bucket and the per-seat price rises. It also falls, sometimes sharply, because some fare products only quote at two or more.
- **A fare can vanish entirely.** An itinerary that prices for one seat may return nothing at two. That flight is not an option for a pair, and it shows up nowhere in a solo-only search.

Never compare on `price` — that is the party total, so a 2-adult search reads as roughly double for the same seat. Compare on `price_per_seat`.

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
    "shuttle_legs": "departure",
    "party": "2a",
    "compare_parties": ["1a", "2a"]
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
| `party` | Who normally flies *this route*, overriding the top-level `default_party`. See below. |
| `compare_parties` | Party specs to price side by side on this route, overriding the top-level `compare_parties`. |
| `notes` | Free text shown to the user during confirmation |
| Any preference key | Per-preset override of a top-level preference (e.g. a higher `budget_usd` for a long route) |

### `party` per preset — the route where the party is different

The top-level `default_party` covers the usual case. A per-preset `party` covers the route that does not match it: someone who flies solo for work but drives their partner home for the holidays sets `default_party: "1a"` and `"party": "2a"` on the one preset where two people travel.

Resolution order, most specific first:

1. What the user said this run ("just me this time")
2. The matched preset's `party`
3. Top-level `default_party`
4. `"1a"`

The same order applies to `compare_parties`. A preset carrying `"compare_parties": ["1a", "2a"]` is saying *on this route the number of seats is genuinely up in the air, so always show me both* — a different statement from `party`, and the two coexist: `party` is what gets booked by default, `compare_parties` is what gets priced.

**Confirm the party out loud every run, the way `shuttle_legs` is confirmed.** A wrong party size produces no error. It produces a correct-looking table for a trip with the wrong number of people in it.

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
