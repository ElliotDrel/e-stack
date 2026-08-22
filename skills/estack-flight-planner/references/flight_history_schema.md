# Flight History Schema — `~/.e-stack/estack-flight-planner/flight_history.json`

Append-only log of every flight search. Used as passive context so the skill can recognize patterns over time ("you've been booking the ~$180 range lately").

## File format

A single JSON array of entry objects. The file is created the first time the skill writes to it; until then the file does not exist.

```json
[
  { entry 1 },
  { entry 2 },
  ...
]
```

To append safely: read the array, push the new entry, write the file back. If the file is missing or corrupt, start a fresh array.

## Entry types

There are two entry types. Each search produces one of each (under normal flow).

### `search_started`

Written immediately after the user confirms Phase 2 preferences and before `fetch_flights.py` runs. Captures what they were looking for, even if they abandon the search before booking.

```json
{
  "type": "search_started",
  "id": "2026-05-11T14:23:07-04:00-3f9a",
  "timestamp": "2026-05-11T14:23:07-04:00",
  "dates": ["2026-05-15", "2026-05-16"],
  "origins": ["IND", "ORD"],
  "destinations": ["EWR", "LGA"],
  "config_snapshot": {
    "budget_usd": 200,
    "budget_strength": "soft",
    "airline_preferences": ["UA", "DL"],
    "airline_preference_strength": "soft",
    "nonstop_preference": "preferred",
    "nonstop_strength": "soft",
    "time_priority_bands": ["11:00-14:00", "14:00-22:00"],
    "time_priority_strength": "soft",
    "had_shuttle": false
  }
}
```

**Fields:**
- `id` — unique identifier for this search. Format: ISO timestamp + 4-char random hex.
- `timestamp` — ISO 8601 with timezone offset
- `dates` — list of YYYY-MM-DD strings the user searched
- `origins`, `destinations` — list of IATA codes used for this search (Phase 1 input)
- `config_snapshot` — preferences as-applied to this search (after any Phase 2 overrides). Don't include `serpapi_key`.

### `selection_made`

Written after the user picks a flight from the ranked output. Links back to the `search_started` entry.

```json
{
  "type": "selection_made",
  "timestamp": "2026-05-11T14:31:42-04:00",
  "search_started_id": "2026-05-11T14:23:07-04:00-3f9a",
  "chosen_flight": {
    "date": "2026-05-15",
    "flight": "UA 1234",
    "from": "IND",
    "to": "EWR",
    "departs": "13:45",
    "arrives": "16:20",
    "price": 178,
    "stops": 0,
    "airline": "United"
  },
  "chosen_shuttle": null,
  "total_cost": 178,
  "options_shown_count": 7
}
```

**Fields:**
- `search_started_id` — id of the matching `search_started` entry
- `chosen_flight` — the flight dict from `filter_flights.py` output
- `chosen_shuttle` — the shuttle dict from `pair_shuttles.py` if pairing was used, else null
- `total_cost` — flight + shuttle USD
- `options_shown_count` — how many options the user could pick from

## How the skill uses the log

- **Pattern surfacing (passive):** When relevant, the skill can read recent entries to note things like "Your last 3 trips picked flights between $160–$200 — flagging the $245 option as out-of-pattern."
- **Abandoned-search detection:** A `search_started` with no matching `selection_made` within the same day suggests an abandoned search. The skill should not bring these up unprompted.
- **Privacy:** The log lives on the user's local disk, unencrypted. Don't put the SerpAPI key or any other secret in `config_snapshot`.

## Pruning

The file grows by 2 entries per booking. Pruning is the user's responsibility — they can delete it or keep it indefinitely. The skill does not prune.
