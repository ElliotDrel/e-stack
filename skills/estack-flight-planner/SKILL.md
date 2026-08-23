---
name: estack-flight-planner
version: 1.5.0
description: >-
  (flight-planner) Find and rank flights between any two airports. Handles the
  parts worth automating (fetching every route, parsing SerpAPI's nested shape,
  timezone-aware ground-shuttle buffer math on either end of the trip) and
  leaves filtering and ranking to judgment. Config-driven preferences,
  reusable trip presets, and per-direction shuttle legs live in
  `~/.e-stack/estack-flight-planner/config.json`. Every search is logged.
disable-model-invocation: true
---

# Flight Planner

A deterministic flight search and ranking pipeline. The user supplies their trip (dates + origin + destination) every run; everything else (budget, airlines, time windows, duration cap, optional shuttle) comes from a saved preferences config so repeat searches are fast.

The math (filtering, pricing, ranking, shuttle buffer calculation) runs in Python scripts — never eyeballed by the LLM — so results are reproducible. The LLM's job is orchestration and presentation.

## What the scripts own, and what you decide

The scripts exist to do the work that is **repetitive, unavoidable, and expensive to get subtly wrong**. Everything else is yours.

| Scripts own it | Why |
|---|---|
| Fetching every route × date from SerpAPI | Happens every run regardless of the request. Missing a route means silently recommending the wrong flight. |
| Parsing SerpAPI's nested shape | Full of traps: arrival time is on the *last* leg, the delay flag is per-leg, a "UA" itinerary can have an AA second leg. Wrong here poisons everything downstream. |
| Shuttle buffer math | Timezones, overnight rollover, day-of-week schedules. Fiddly, and a silent hour of error puts someone at a closed airport counter. |

**You own filtering, ranking, and the shape of the answer.** Those depend entirely on what this particular user asked for this particular time, and there is no reason to squeeze that into a fixed set of flags.

So: **`load_flights.py` is the real entry point after fetching.** It hands you every itinerary with every field SerpAPI returned (per-leg detail, layover airports and durations, delay and overnight flags, legroom, aircraft, operating carrier, carbon, price insights) and filters nothing.

`filter_flights.py` is an optional convenience covering the common case (budget, airlines, nonstop, time windows, duration). Reach for it when it genuinely fits. The moment the user wants something it doesn't express — "nothing connecting through Charlotte", "I'll pay $60 to land before 6pm", "red-eyes only", "cheapest per hour of my time", "no aircraft with under 30 inches of legroom" — **stop using it and write the pass yourself.** Contorting a real request into `--max-price` and `--soft-filters` gives a worse answer than five lines of Python.

**Put one-off scripts in the scratchpad.** If your harness gives you a session scratchpad directory, write them there; otherwise a temp directory. Never write them into the skill folder, and never edit the shipped scripts to handle a single request. Those scripts are shared by every user of this skill; your custom filter is for this conversation.

```python
# <scratchpad>/pick_flights.py  -- one-off, throwaway, not part of the skill
import json, subprocess, sys
flights = json.loads(subprocess.run(
    [sys.executable, "scripts/load_flights.py", "--json-dir", JSON_DIR],
    capture_output=True, text=True).stdout)

# whatever the user actually asked for
ok = [f for f in flights
      if not any(lo["airport"] == "CLT" for lo in f["layovers"])
      and f["arrives"] < "18:00"
      and f["legroom"] >= "30 in"]
ok.sort(key=lambda f: f["price"] + (0 if f["stops"] == 0 else 60))
json.dump(ok, open(OUT, "w"), indent=2)
```

The output shape matches `filter_flights.py`, so `pair_shuttles.py` accepts it either way.

## Three things that are easy to get wrong

**1. The shuttle can be on either end of the trip.** A ground shuttle pairs with a flight in two different ways, and which one applies depends on the direction the user is travelling:

| Leg | When it applies | Rule |
|---|---|---|
| Pre-flight (`to_airport`) | The user is *leaving* from the shuttle's home town | Shuttle must **arrive** at the airport before the flight departs |
| Post-flight (`from_airport`) | The user is *arriving* at an airport near the shuttle's home town | Shuttle must **depart** the airport after the flight lands |

Both can apply to one itinerary, one can, or neither.

**Always ask which ends need a ride. Never infer it.** Having a shuttle configured for an airport does not mean the user wants one on this trip — they may be getting dropped off, driving and parking, staying with someone near the airport, or stopping somewhere else on the way. Ask plainly:

> Do you need a ride to the airport, from the airport, both, or neither?

A saved preset can carry a default (`shuttle_legs`), and that default is usually right, which is exactly why it still gets confirmed out loud every run rather than applied silently. A wrong assumption here doesn't produce a visible error; it produces a table quietly ranked around a $55 cost the user was never going to pay.

Once you know which legs are needed, fetch **only those directions** — and fetch them properly. A user flying *to* their home town needs the airport-to-town schedule, and scraping only the outbound one produces a table that silently drops every flight.

**2. Every price SerpAPI returns is a party total, never a per-passenger fare.** A 2-adult search reads roughly double a 1-adult search for the same seat. `load_flights.py` does the division for you and emits `price_per_seat` alongside `price`, plus `seats` and `party_label`. **Compare on `price_per_seat`.** Comparing on `price` makes a bigger party look like a worse deal on every single row.

Three consequences worth holding on to:

- **Confirm the party out loud every run**, the same way `shuttle_legs` gets confirmed. A wrong party size throws no error. It produces a correct-looking table for a trip with the wrong number of people in it. Resolution order is: what the user said this run, then the matched preset's `party`, then top-level `default_party`, then `1a`.
- **A fare can vanish at a larger party.** An itinerary that prices for one seat may return nothing at two, because the cheap bucket had one seat left. That flight is simply not an option for a pair, and a solo-only search never reveals it. `compare_parties` exists to surface exactly this.
- **Ground cost scales with seats; the flight fare already did.** `price` covers everyone, but a shuttle fare is one ticket for one rider, so two people buy two shuttle seats. `pair_shuttles.py` reads `seats` off each itinerary and reports `shuttle_cost` (one rider), `shuttle_cost_party` (all of them), `total`, and `total_per_seat`. Lap infants are passengers but not seats, so they never dilute a per-seat number or add a shuttle ticket.

**3. Soft means soft.** A soft preference is worth a fixed number of dollars in the ranking, not a veto. `filter_flights.py` scores every flight as `price + penalties` so a $400 flight matching every preference will not outrank a $189 flight that misses one. Don't re-sort the script's output by hand.

## Show progress on every question

**Every question you ask the user must show how many questions are left in the current phase.** Use a prefix like `[Q 2 of 7]` or end with `(2 questions left after this)`. This applies to Phase 1, Phase 2 wizard, Phase 2 confirmation prompts, and any clarifying follow-ups within a phase.

Counting rules:
- Each value question and each strength question count separately (so a 4-preference wizard with strengths = 8 questions, plus 3 non-strength = 11 total).
- Skip questions that don't apply (e.g., nonstop strength when user picked "no preference") don't count toward the total — recompute remaining as you go.
- In **batch mode**, count each line in the batch as one question, and tell the user "this batch has N questions" up front.
- In **Phase 2 confirmation mode** (returning user), it's effectively 1 question ("are these still your prefs?") — say so.
- Phase 1 has 1 question (the open "where/when").

Example phrasing:
- One-at-a-time: `[Q 3 of 11] What's your max budget per flight in USD?`
- Batch header: `Here are 4 questions in one batch — answer in any order:`

## Operating mentality — boil the ocean

**Don't make the user do work you could do yourself.** When the user gives a vague trip ("this weekend, Indiana to NJ"), do NOT bounce back with "please give me IATA codes and exact dates." Use your tools to fill in everything inferable, then present a complete proposed plan and let the user adjust.

For every vague input, before asking a follow-up, exhaust:
- **`date` command via Bash** for any relative date ("this weekend", "next Friday", "in 3 weeks")
- **`WebSearch`** for nearby major airports given a city/state/region (e.g., "Indiana" → IND, SBN, FWA; "NJ" → EWR, plus nearby LGA, JFK, PHL)
- **Config defaults** (`home_airport`, `frequent_destinations`) for likely matches
- **Flight history** for recent route patterns
- **Common sense + sanity checks** — e.g., if user says "Indiana" and config has `home_airport: IND`, lead with IND.

Then present:

> Here's what I worked out — adjust anything that's off:
> - **Dates:** 2026-05-16 (Sat) — 2026-05-17 (Sun)  ← resolved from "this weekend"
> - **Origin:** IND (Indianapolis) — also nearby: SBN (South Bend), FWA (Fort Wayne)
> - **Destination:** EWR (Newark) — also nearby: LGA, JFK
>
> Want me to expand origin/destination to include the nearby airports, or run with just IND→EWR? Any changes to dates?

**The bar is "holy shit, that's done," not "good enough."** Never present a workaround when the real fix is one tool call away. Never offer to "ask more questions later" when you can answer them now. Never leave a dangling assumption — confirm it visibly. Search before asking. Verify before shipping.

This applies to every phase, not just Phase 1. If the user later says "actually, just nonstops" without specifying strength, infer `hard` from "just" and confirm in your next message, rather than asking a separate strength question.

## Files

- `scripts/check_setup.sh` — Deterministic startup check (runs in Phase 0)
- `scripts/party.py` — Party specs (`1a`, `2a3c`, `1a1l`), seat counting, filename tokens. Shared by fetch and load; don't reimplement the parsing.
- `scripts/fetch_flights.py` — SerpAPI Google Flights wrapper
- `scripts/load_flights.py` — Normalize every itinerary, filtering nothing. Start here after fetching.
- `scripts/filter_flights.py` — Optional convenience filter/rank/cluster-analyze for the common case
- `scripts/pair_shuttles.py` — Optional: pair flights with a ground shuttle on either end
- `references/config_schema.md` — Full config.json field reference, including trip presets
- `references/flight_history_schema.md` — Flight log format reference
- `references/shuttle_schedules.md` — Shuttle schema, both directions, and how to scrape a schedule page

## Persistent state (not in the skill directory)

- `~/.e-stack/estack-flight-planner/config.json` — User preferences. Created via first-run wizard. Never overwritten by skill installer.
- `~/.e-stack/estack-flight-planner/flight_history.json` — Append-only log of searches and selections.

`~` expands to `%USERPROFILE%` on Windows and `$HOME` on Mac/Linux.

## Workflow — four phases

Run these in order every time. Do not skip Phase 2 even if the config looks right.

### Phase 0 — Setup check (deterministic, runs on skill load)

The fenced command below runs automatically when the skill is invoked. Read its output before doing anything else — it tells you the user's setup state without you having to ask.

```!
bash ~/.agents/skills/estack-flight-planner/scripts/check_setup.sh
```

The output reports:
- Today's date and local timezone (use this when converting relative dates in Phase 1)
- Whether `~/.e-stack/estack-flight-planner/config.json` exists, and if so, all current preferences (and a warning if a deprecated `serpapi_key` is still sitting in it)
- Any saved **trip presets**, with their aliases — these are the fast path in Phase 1
- The shuttle service: providers, costs, buffer settings, and how many schedule URLs to fetch
- Whether `SERPAPI_KEY` is set, in the environment or in `~/.e-stack/.env`
- Whether `~/.e-stack/estack-flight-planner/flight_history.json` exists and how many entries it has

**Decision tree based on output:**
- **Config exists** → Phase 1 (ask trip details), then Phase 2 in confirmation mode (show saved prefs, ask "still right?")
- **Config missing** → Phase 1 (ask trip details), then Phase 2 in wizard mode (walk through each preference, offer to save at end)
- **No `SERPAPI_KEY` in the environment or `~/.e-stack/.env`** → tell the user up front that you'll use the WebSearch fallback in Phase 3 Step 2, with the caveat about coverage
- **Shuttle configured but zero schedule URLs** → say so now. Pairing cannot run without them, and finding that out in Phase 3 wastes a full search.

Don't repeat back the setup output to the user verbatim — just internalize it and adapt your behavior.

**After Phase 0 finishes, present an overview to the user before Phase 1:**

Tell the user, in your own words:
- What this skill does: finds and ranks flights between any two airports using their preferences.
- How it works: 4 phases — (1) Trip details (where/when), (2) Preferences (confirm saved config or run a first-run wizard), (3) Run the search pipeline (fetch → filter → rank → optional shuttle pairing), (4) Recommend and log.
- Where state lives: `~/.e-stack/estack-flight-planner/config.json` (preferences) and `~/.e-stack/estack-flight-planner/flight_history.json` (search log).
- Whether they're in first-run wizard mode or returning-user mode (based on Phase 0 output).

**Pacing for Phase 2 wizard (first-run only):** If Phase 0 showed no config, the user will face a multi-question wizard in Phase 2. Right after the overview, ask once: "When we get to your preferences setup, do you want me to ask all questions one at a time, or batch them so you can answer in one message?" Skip this question entirely if a config already exists (returning user — Phase 2 is just confirmation).

### Phase 1 — Trip details (one question, then a proposed plan)

Per the "boil the ocean" mentality above, **do not ask three separate questions**. Ask ONE open question, then do the work:

**The single question:** "Where are you going and when?" (Wait for answer.)

The user may answer with anything from "May 16-17 IND→EWR" (already precise) to "this weekend Indiana to NJ" (vague). Either way, the next thing you do is **resolve every inferable detail with your tools**, then present a proposed plan.

**First: check the trip presets.** If the answer matches a preset's slug, label, or any of its `aliases` — "flying home", "back to campus", "NJ to Purdue" — the route is already decided. **Skip step 2 below entirely.** No airport WebSearch, no alternates hunt; the user already did that research when they saved the preset. Resolve dates, then jump straight to the proposed plan:

```
Matched your saved preset "home-to-purdue" (NJ -> Purdue).

  Dates:       2026-08-20 (Thu), 2026-08-21 (Fri)
  Origins:     EWR, LGA, JFK
  Destinations: IND, ORD
  Shuttle:     post-flight (land, then ride to West Lafayette)
  Note:        IND is a 2h/$25 ride; ORD is ~3.5h/$55 but often cheaper to fly into.

Run it?
```

A preset removes the research, not the confirmation. Still show the resolved plan and wait for a yes. If the user's phrasing is close to but not clearly one of the presets, name the one you think they mean and ask — don't silently pick.

**Tool steps before you respond (no preset matched):**

1. **Resolve dates deterministically with the `date` command via Bash.** Never guess or do calendar math in your head.
   - Today: `date +%Y-%m-%d`
   - Next Friday (Linux/WSL): `date -d 'next Friday' +%Y-%m-%d`
   - Next Friday (macOS): `date -v+Fri +%Y-%m-%d`
   - "+N weeks": `date -d '+N weeks' +%Y-%m-%d` (Linux) / `date -v+Nw +%Y-%m-%d` (macOS)
   - PowerShell fallback: `(Get-Date).AddDays(N).ToString('yyyy-MM-dd')`
   - For "this weekend" / "next weekend", compute both Sat and Sun explicitly.

2. **Resolve airports — always WebSearch for common alternates, even when the user gave an exact IATA code.**
   - Check config first: does `home_airport` or `frequent_destinations` match the region? Lead with those.
   - **WebSearch is mandatory for every origin and every destination**, not just vague ones. Queries to run:
     - "major airports near <location>" (when user gave a city/state/region)
     - "airports within 100 miles of <IATA or city>" (to find common alternates even for a specific airport)
     - "alternate airports to <IATA>" (e.g., user says EWR → surface LGA, JFK; user says LAX → surface BUR, LGB, SNA, ONT)
   - Aim for 1 primary + 2–3 nearby alternates per endpoint. Alternates often save significant money on flights.
   - Output IATA + full city name + approximate distance from the user's stated location so they can verify (e.g., `LGA (LaGuardia) — ~15mi from Newark`).
   - **Never skip the alternate search.** A user who said "EWR" may not realize LGA flights to their destination are $80 cheaper — your job is to surface that option.

3. **Sanity-check the result yourself** before showing it. Are the dates in the future? Do the airports actually exist? Does the route make geographic sense?

**Then present the proposed plan in a single block:**

```
Here's what I've worked out — adjust anything that's off:

  Dates:       2026-05-16 (Sat), 2026-05-17 (Sun)        ← from "this weekend"
  Origin:      IND (Indianapolis)
               Also nearby: SBN (South Bend), FWA (Fort Wayne)
  Destination: EWR (Newark)
               Also nearby: LGA (LaGuardia), JFK (Kennedy)

Want me to widen origin/destination to include the nearby airports, or
run with just IND→EWR? Any changes to dates?
```

If the user says "looks good" → proceed to Phase 2 with that route. If they tweak it ("add LGA, drop Sunday") → apply the change and proceed; no need to re-confirm a third time unless something is now ambiguous.

Origin and destination are **never saved to config by default**. The user can opt in to saving them as `home_airport` / `frequent_destinations` in Phase 2 if they want.

**Offer to save a preset when a route is worth repeating.** After a search finishes on a route with no matching preset, and only if the user seems likely to fly it again (they mention school, work, family, "every semester", or it's their second search on the same pair), ask once: *"Want me to save this as a preset so next time you can just say 'flying home' and skip the airport research?"* If yes, write it into `trip_presets` with a slug, a label, the origins/destinations you resolved, and 2-3 aliases in the user's own words. Never save one unprompted.

### Phase 2 — Preferences confirmation

**If `~/.e-stack/estack-flight-planner/config.json` exists:**

Read it and show a single block:

```
Your saved preferences:
  Budget:           $200 (soft)
  Airlines:         UA, DL (soft)
  Nonstop:          preferred (soft)
  Time priority:    11:00–14:00, 14:00–22:00 (soft)
  Max duration:     8h (soft)
  SerpAPI key:      set (~/.e-stack/.env)
  Shuttle service:  Acme Express — IND $25, ORD $55

For this trip:
  Ride FROM the airport at IND/ORD  → yes (preset default)
  Ride TO the airport at EWR        → no  (no shuttle configured there)
  Flying                            → 1 adult (also pricing 2, per preset)

Still right? (yes / change <field>)
```

**The party line and the shuttle line are never folded into a general "yes".** Both get called out as their own items, for the same reason: a wrong value on either produces no error, just a correct-looking table costed for the wrong trip.

**The shuttle line is never folded into a general "yes".** Call it out as its own item every run, even when the preset default has been correct twenty times running. The user might be getting a ride, driving, or stopping somewhere on the way, and none of those show up as an error later — they just quietly skew the ranking around a cost that was never real.

If the user says "yes" → proceed to Phase 3. If they want to tweak a field for this run only, capture the override without writing it to disk. If they want a permanent change, ask "save this change to your config?" before writing.

**If no config file exists:**

Run the first-run setup wizard. **Strength questions are always separate from value questions** — never bundle "Budget: $200, hard or soft?" into one ask. The pacing the user chose after the overview determines how to sequence:

**The four strength-paired preferences:**

| # | Preference | Value question | Strength question |
|---|---|---|---|
| 1 | Budget | "What's your max budget per flight in USD?" | "Is the $X budget hard (exclude anything over) or soft (include but rank cheaper higher)?" |
| 2 | Airlines | "Any airline preferences? (IATA codes like UA, DL, AA — or 'none' for any airline)" | "Are <airlines> hard (only show these) or soft (prefer them but show others)?" |
| 3 | Nonstop | "Required / preferred / no preference for nonstop?" | (Only if not "no preference") "Is that hard (exclude stops) or soft (rank stops lower)?" |
| 4 | Time-of-day priority | "Priority time windows for departure? (e.g., 11:00-14:00,14:00-22:00 in 24h format — or 'none')" | (Only if not "none") "Is the <windows> priority hard (exclude flights outside) or soft (rank lower but include)?" |
| 5 | Max trip length | "Longest total trip you'd accept, gate to gate including layovers? (e.g. 8h — or 'no limit')" | (Only if not "no limit") "Is <N>h hard (exclude longer) or soft (rank longer ones lower)?" |

**One-at-a-time mode:**

For each preference, ask the value question → wait for answer → ask the strength question (echoing the chosen value verbatim) → wait for answer → move to the next preference.

**Batch mode:**

Send TWO batches:

- **Batch A — values.** Ask all four value questions in one message. Wait for all answers.
- **Batch B — strengths.** Echo each value back and ask its strength in one message. Example:
  ```
  Got it. Now strength for each — hard (filter) or soft (rank)?

    1. Budget = $200            → hard or soft?
    2. Airlines = UA, DL        → hard or soft?
    3. Nonstop = preferred      → hard or soft?
    4. Times = 11–14, 14–22     → hard or soft?
  ```
  Skip lines in Batch B where strength doesn't apply (airlines = "none", nonstop = "no preference", times = "none").

**After the strength-paired preferences, ask the remaining non-strength questions** (these don't need a strength companion). One at a time, or one final batch — match the user's chosen pacing:

6. **Usual party** — "Who normally flies with you? (just me / 2 adults / 2 adults and 2 kids / something else)". Saves as `default_party`. A solo traveller answers once and never thinks about it again; a family gets family pricing on every search without restating it. If the answer is genuinely variable ("depends, sometimes just me"), offer `compare_parties` instead so both sizes get priced side by side.
7. **SerpAPI key** — "Do you have a SerpAPI key? (yes — paste it / no — explain how to get one / skip — use WebSearch fallback)". See the SerpAPI walkthrough section below.
8. **Optional fields** — "Want to save a home airport so we suggest it next time? (IATA code or 'no')". Same for `frequent_destinations`.
8. **Optional shuttle service** — "Do you use a ground shuttle between your town and an airport? (yes / no)". If yes, ask for:
   - company name(s) — more than one company serving the same airport is fine and supported
   - schedule URL(s)
   - which airports each company serves
   - one-way cost per airport
   - **which ends they actually need a ride on** — to the airport, from it, both, or "depends on the trip". This becomes `shuttle_legs` on their presets and it is asked again every run regardless.
   - if they ride in both directions, you need the return schedule too, not just the outbound one
   - how much advance notice the company requires (many require 24h)

   See `references/shuttle_schedules.md` for the full sub-schema.

After collecting answers, show the full config and ask "Save this to ~/.e-stack/estack-flight-planner/config.json?" before writing.

### Phase 3 — Execute

Run the scripts. Do all math via the scripts, never in your head.

**Step 1 — Log search start**

Append a `search_started` entry to `~/.e-stack/estack-flight-planner/flight_history.json` with timestamp, dates, route, and a snapshot of the preferences used (after Phase 2 overrides). See `references/flight_history_schema.md` for the exact format.

**Step 2 — Fetch live flight data**

If the user has a SerpAPI key:

```bash
python scripts/fetch_flights.py \
  --dates 2026-05-09,2026-05-10 \
  --routes "IND,ORD-EWR,LGA,JFK" \
  --parties 1a,2a \
  --airlines UA,DL \
  --stops 1
```

Pass `--airlines` only if the user has airline preferences. Pass `--stops 1` only if `nonstop_preference` is `required` or `preferred` with `hard` strength. Omit both for "any airline, any stops".

**Collapse routes before you fetch.** `departure_id` and `arrival_id` both take comma-separated airport lists, so `"IND,ORD-EWR,LGA,JFK"` is **one** API call covering all six pairs, not six calls. On a 100-call-a-month free tier that is the difference between one search and six. Use `;` between genuinely separate routes.

**`--parties` sets who is flying**, as one or more specs (`1a`, `2a`, `2a3c`, `1a1l`). Each spec is its own API call, so `--parties 1a,2a` doubles the quota a search costs — pass a second one only when `compare_parties` is set or the user actually asked. `--adults`/`--children` are the shorthand for a single party. Filenames carry a `_p<spec>` token so `load_flights.py` can read the party back off them; a file without one is read as a single adult.

The script reads `SERPAPI_KEY` from the environment or accepts `--api-key`. Saves raw JSON to a temp directory and prints the directory path on stdout — capture this for the next step.

**If the user has no SerpAPI key:** Use WebSearch to query flight prices for each route × date combination. Tell the user up front: "Without a SerpAPI key, results will be less comprehensive — I'll search the web for each route but won't have structured price/time data." Build a JSON file in the same shape `fetch_flights.py` would produce so the downstream scripts work unchanged. If you're not confident the WebSearch results are reliable, say so and recommend they get a key.

**Step 3 — Load the data, then decide what's good**

Always start by loading everything:

```bash
python scripts/load_flights.py --json-dir <temp-dir-from-step-2> --with-meta
```

`--format table` gives a quick scan; `--with-meta` adds SerpAPI's own price insights per route/date (`lowest_price`, `price_level`, `typical_price_range`), which is what lets you say "this is a high fare for this route" rather than just quoting a number.

Now pick your path:

- **The request fits the common shape** (budget, airlines, nonstop, time windows, duration) → use `filter_flights.py` below.
- **It doesn't** → write a short pass in your scratchpad over the loaded JSON. This is the expected route, not a fallback. Say what rule you applied so the user can correct it.

Either way the result is a JSON array that `pair_shuttles.py` accepts.

```bash
python scripts/filter_flights.py \
  --json-dir <temp-dir-from-step-2> \
  --max-price 200 \
  --time-priority "11:00-14:00,14:00-22:00" \
  --from IND,ORD \
  --to EWR,LGA \
  --airlines UA \
  --nonstop \
  --max-duration-min 480 \
  --soft-filters max-price,time-priority,airlines,nonstop,duration
```

Pass `--soft-filters` listing every preference whose strength is `soft` — those become rank weights instead of hard filters. Pass all hard preferences as strict filters with no `--soft-filters` entry.

A `preferred` + `soft` nonstop setting means you still pass `--nonstop` **and** list `nonstop` in `--soft-filters` — the flag defines the preference, the soft list decides whether it excludes or just ranks.

**Ranking.** Every flight comes back with `rank_score` (dollars: price + a penalty for each soft preference it misses) and `rank_explanation` (the arithmetic). The output is already sorted by it. Default penalties are `nonstop $60, route $50, airlines $40, duration $40, time-priority $30, max-price $0` plus `$15` per rung down the time-band list. `max-price` is $0 on purpose — the overage is already in the price, so charging it again would double-count.

Override with `--soft-penalties "airlines:80,nonstop:120"` when the user says a preference matters more than the default weighting implies ("I really don't want a connection"). Say what you changed and why.

The script outputs filtered flights as JSON to stdout. Capture it for step 5.

**Step 4 — Handle empty results (constraint relaxation)**

If step 3 came back empty, **never just report "no flights found"** — the flights exist, your constraints ate them. Say which constraint did it and what relaxing it would cost.

Wrote your own pass? Count how many itineraries each condition eliminated on its own; that's a three-line loop over the loaded data and it's the whole answer.

Used `filter_flights.py`? Rerun with `--cluster-analysis`, which does the same thing for its built-in constraints:

```bash
python scripts/filter_flights.py --json-dir <dir> --cluster-analysis
```

Read the report — it shows which constraint(s) eliminated which flight counts plus a price distribution. **Propose specific relaxations to the user**, not generic "try again with looser settings":

- "Your $200 hard budget filtered all 23 flights. Cheapest available is $237. Want to raise the budget to $240?"
- "The 11:00–22:00 window filtered out 15 morning flights. Want to add a 06:00–11:00 priority band?"
- "Airline filter (UA only) eliminated 18 of 23 flights. Want to drop the airline filter for this search?"

Wait for the user to pick a specific relaxation, then rerun step 3 with adjusted args.

**Step 5 — Pair shuttles (only if `shuttle_service` is set in config)**

Skip this entire step if the user's config has `shuttle_service: null`. Otherwise:

**5a. Use the answer the user gave you in Phase 2** about which ends need a ride. Never re-derive it from which airports happen to have a shuttle configured.

- Ride to the airport → fetch the **pre-flight** (`to_airport`) schedule, pass `--legs pre`.
- Ride from the airport → fetch the **post-flight** (`from_airport`) schedule, pass `--legs post`.
- Both → fetch both, pass `--legs both`.
- Neither → skip this step entirely and show a flights-only table. Don't add a shuttle cost the user isn't paying.

`--legs auto` pairs whichever legs the shuttle data can serve. It's the right default only when the user confirmed they want a ride wherever one exists.

**5b. Fetch the schedules.** WebFetch every URL in every provider's `schedule_urls`, in parallel. Prompt for **both directions explicitly** — most schedule pages carry the outbound and return tables on the same page, and a prompt that only names one direction will come back with only one. Ask for departure time, arrival time, stops, and operating days per run.

If a direction you need isn't on the page, say so and go find it (a sibling URL, the company's schedule page) rather than assuming the return mirrors the outbound. Times that come back ambiguous across a timezone line are worth flagging to the user rather than guessing.

**5c. Build `shuttles.json`** matching the schema in `references/shuttle_schedules.md`: one object per run, each with `airport`, `direction`, `departs_local`, `arrives_local`, and `days` where the schedule varies by weekday. Then:

```bash
python scripts/pair_shuttles.py \
  --flights-json <filtered-output-from-step-3> \
  --shuttles-json <shuttles-file> \
  --shuttle-costs "IND:25,ORD:55" \
  --legs auto \
  --min-buffer-min 90 \
  --min-connect-min 60 \
  --max-wait-min 240 \
  --now "<today's date and time, ISO>" \
  --reservation-lead-hours 24
```

| Flag | Source | Notes |
|---|---|---|
| `--shuttle-costs` | `shuttle_service.costs` | Charged once per leg used |
| `--legs` | derived in 5a | `auto` pairs whichever legs the data can serve; `pre`/`post` force one; `both` requires both and drops flights missing either |
| `--min-buffer-min` | `shuttle_service.min_buffer_min` | Pre-flight floor (shuttle arrival → flight departure) |
| `--min-connect-min` | `shuttle_service.min_connect_min` | Post-flight floor (landing → shuttle departure). Raise it if the user checks bags. |
| `--now` / `--reservation-lead-hours` | today + config | Flags pairings inside the company's booking cutoff |
| `--include-unpaired` | — | Add it when a lot of flights got dropped and the user should see them anyway |
| `--format json` | — | Use when you need the numbers rather than the table |

Read the stderr summary line — it says how many flights paired and how many were dropped for missing which leg. If a large share dropped, that usually means a direction is missing from `shuttles.json`, not that the flights are bad.

**Step 6 — Present results**

- If pairing was done: show the markdown table from `pair_shuttles.py` directly. It's already ranked; don't re-sort it.
- If no shuttle: print a flights-only table with Date | Flight | Route | Departs | Arrives | Price | Airline | Stops | Notes.

Long result sets are normal. Show the top 10-15 rows, say how many there are in total, and offer the rest.

Recommend the top row in one or two sentences, and say what the runner-up trades against it (cheaper but a tighter connection, later but nonstop). Ask which flight they want to book.

**Step 7 — Log the selection**

When the user confirms a choice, append a `selection_made` entry to `~/.e-stack/estack-flight-planner/flight_history.json`, linking back to the `search_started` entry from step 1. See `references/flight_history_schema.md`.

**Step 8 — Offer booking link**

Give **two** links: the airline's own search page, and a Google Flights fallback. Airline sites are client-rendered apps behind bot protection, so you cannot load one to check your own URL — the fallback is what saves the user a round trip when the deep link is stale.

```
https://www.google.com/travel/flights?q=Flights%20from%20<DEP>%20to%20<ARR>%20on%20<DATE>%20nonstop%20<AIRLINE>
```

**Say plainly that these open a pre-filled search, not a purchase.** No airline supports deep-linking into checkout for one specific flight, so the user lands on a results list and picks the departure time out of it. Name the time so they know which row to click.

**Three ways an airline deep link goes wrong**, all silent — the page loads and shows *something*, just not what was asked for:

1. **The trip-type flag is often inverted or non-obvious.** Getting it wrong returns round-trip prices for a one-way search, which look wrong by roughly double.
2. **Booking paths get moved between site versions.** An old path may still resolve to a redirect or an empty form rather than a 404.
3. **Prices may default to base fare, excluding taxes and fees.** The quoted number then undercuts what the user actually pays.

Check the parameters against a current source before handing the link over rather than reconstructing one from memory. If you cannot verify, lead with the Google Flights link and say the airline one is unverified.

United, verified 2026-08-10 against [this breakdown of united.com's search deep link](https://browse.sh/skills/united.com/search-flights-xs5157.md):

```
https://www.united.com/en/us/fsr/choose-flights?f=<DEP>&t=<ARR>&d=<YYYY-MM-DD>&tt=0&sc=7&px=1&taxng=1&clm=7&st=bestmatches
```

`tt=0` is one-way and `tt=1` is round-trip (backwards from what you'd guess). `taxng=1` shows all-in pricing; without it the fare reads low. `clm=7` is economy. **`px` is the passenger count — set it to the party's seats, not left at `1`**, or the user opens a page priced for a trip they aren't taking. Airport must be an IATA code. The old `/en/us/flight-search/book-a-flight` path no longer serves this.

**Flag a restricted fare before the user buys.** If the itinerary is a basic/no-frills fare brand, say so and name what it costs them in practice: baggage limits, no seat selection, no changes or refunds. That last one matters most when the trip is pinned to a fixed date (a lease start, a first day of work) where a slip makes the ticket worthless rather than movable. Do not assert a specific airline's current baggage rule from memory — point the user at the checkout screen, where the real number appears.

## SerpAPI walkthrough

If the user doesn't have a SerpAPI key and asks for help getting one:

1. Tell them: "SerpAPI gives the skill structured Google Flights data. Free tier is 100 searches/month — usually enough for personal trip planning. Paid plans start at $50/month."
2. Walk them to https://serpapi.com/users/sign_up — sign up with email.
3. After signup, the API key is at https://serpapi.com/manage-api-key.
4. To set it permanently, add one line to `~/.e-stack/.env`, the shared credential file every e-stack skill reads:
   ```
   SERPAPI_KEY=<their-key>
   ```
   **Append to that file, never overwrite it** — other skills keep their keys there too. Create it if it does not exist. Setting `SERPAPI_KEY` in their shell profile also works and takes precedence. Never put the key in `config.json`; nothing reads it there.
5. If they don't want a key: confirm they want the WebSearch fallback. Tell them: "I'll use WebSearch each run. Results won't be as complete and prices may be approximations."

## Important behaviors

**Always run the scripts.** Don't summarize flights from memory. If the conversation has stale flight data from a previous run, re-fetch.

**Strength matters.** Hard filters exclude; soft filters rank. Pass soft filters via `--soft-filters` to keep non-matching results visible.

**Don't re-rank by hand.** The scripts emit `rank_score` and `plan_score` on one dollar scale. If the order looks wrong, the fix is a `--soft-penalties` override you can explain, not a manual reshuffle.

**Round trips are priced as two one-ways.** `fetch_flights.py` queries one-way fares (SerpAPI `type=2`). For a round trip, run the whole pipeline once per direction and show two tables. Say plainly that some carriers price a true round trip below two one-ways, so the total is an upper bound worth checking on the airline's own site before booking.

**No shuttle data ships with this skill.** Each user provides their own shuttle service info in their config. The skill scrapes their schedule URLs at search time.

**A shuttle serves two directions.** Fetching only the outbound schedule is the most common way to end up with an empty pairing table. Check which leg(s) the trip needs before you fetch.

**A configured shuttle is not a needed shuttle.** Ask which ends want a ride every single run, even when the preset default has been right every time before. Getting this wrong produces no error, just a ranking bent around a cost nobody was going to pay.

**Don't reshape the user's request to fit the flags.** `filter_flights.py` covers the common case only. Anything else gets a scratchpad script over `load_flights.py` output.

**Origin and destination are not saved by default.** Only save them if the user explicitly opts in. Trip presets are the exception — they exist to be saved, but only when the user says yes.

**Two log entries per search.** Entry 1 on fetch (step 1), entry 2 on selection (step 7). Both are written even if the user abandons mid-search — the search_started entry preserves what they were looking for.

**Times in the config are 24-hour HH:MM format.** Display them in 12-hour to the user but store 24-hour.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then file the issue using whichever method is available:

**If `gh` is installed** (`gh --version` succeeds), create the issue directly:

```bash
gh issue create \
  --repo ElliotDrel/e-stack \
  --title "estack-flight-planner: <concise summary>" \
  --body "<description from user feedback — expected vs. actual behavior and context>"
```

**If `gh` is not installed**, build a pre-filled URL:

```bash
python3 -c "
import urllib.parse
title = 'estack-flight-planner: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user and offer to open it in their browser.

They can also click it directly, review the pre-filled title and body, and click **Submit new issue**.
