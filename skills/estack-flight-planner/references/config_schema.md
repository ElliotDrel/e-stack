# Config Schema — `~/.flight-planner/config.json`

The skill stores user preferences in this file. It's outside `~/.claude/skills/` so the e-stack installer never overwrites it.

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

  "home_airport": null,
  "frequent_destinations": [],

  "shuttle_service": null
}
```

## Field reference

### `serpapi_key`
- Type: string or null
- Your SerpAPI key for Google Flights queries. If null, the skill falls back to WebSearch (less comprehensive — see SKILL.md).
- Get one at https://serpapi.com/manage-api-key.

### `budget_usd`
- Type: int
- Max flight price in USD.

### `budget_strength`
- Type: `"hard"` or `"soft"`
- `hard` = filter out flights above budget. `soft` = include them but rank cheaper ones higher.

### `airline_preferences`
- Type: array of IATA airline codes (e.g., `["UA", "DL"]`)
- Empty array = any airline.

### `airline_preference_strength`
- Type: `"hard"` or `"soft"`
- `hard` = only show flights on these airlines. `soft` = prefer them but show others too.

### `nonstop_preference`
- Type: `"required"`, `"preferred"`, or `"no_preference"`

### `nonstop_strength`
- Type: `"hard"` or `"soft"`
- Combined with `nonstop_preference`:
  - `required` + `hard` = filter out anything with stops
  - `required` + `soft` = treat stopovers as a downside but still show them
  - `preferred` + `soft` = rank nonstops first, show stops second (typical setup)
  - `no_preference` = strength is ignored

### `time_priority_bands`
- Type: array of `"HH:MM-HH:MM"` ranges in 24-hour time
- Departures inside the first band rank highest; second band second; outside all bands rank lowest.

### `time_priority_strength`
- Type: `"hard"` or `"soft"`
- `hard` = filter out flights outside all bands. `soft` = include but rank lower.

### `home_airport`
- Type: IATA code or null
- Optional. If set, the skill suggests it when asking for origin in Phase 1 (but still asks).

### `frequent_destinations`
- Type: array of IATA codes
- Optional. Surfaced as suggestions when asking for destination.

### `shuttle_service`
- Type: object or null
- If non-null, the skill pairs flights with ground shuttle runs. See `references/shuttle_schedules.md` for the full sub-schema.

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
  "home_airport": "JFK",
  "frequent_destinations": ["LAX", "SFO", "SEA"],
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
  "home_airport": null,
  "frequent_destinations": [],
  "shuttle_service": null
}
```

### Suburban user with a shuttle service

```json
{
  "serpapi_key": "sk_xxx",
  "budget_usd": 200,
  "budget_strength": "soft",
  "airline_preferences": ["UA"],
  "airline_preference_strength": "soft",
  "nonstop_preference": "preferred",
  "nonstop_strength": "soft",
  "time_priority_bands": ["11:00-14:00", "14:00-22:00"],
  "time_priority_strength": "soft",
  "home_airport": null,
  "frequent_destinations": ["EWR", "LGA"],
  "shuttle_service": {
    "name": "Acme Airport Express",
    "schedule_urls": ["https://acme.example.com/schedule"],
    "costs": {"ORD": 60, "IND": 30},
    "home_timezone": "America/New_York",
    "airport_timezones": {"ORD": "America/Chicago", "IND": "America/New_York"}
  }
}
```

## Strength semantics recap

| Strength | Behavior |
|---|---|
| `hard` | Filter applied strictly — non-matching flights are excluded from output |
| `soft` | Filter applied as a rank weight — non-matching flights still shown, flagged with `soft_filter_violations` and sorted below matching ones |

When hard filters return zero results, the skill runs `filter_flights.py --cluster-analysis` to see which constraint(s) eliminated which flight counts, then proposes specific relaxations.
