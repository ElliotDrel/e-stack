---
name: estack-flight-planner
description: (flight-planner) Find and rank flights between any two airports with config-driven preferences (budget, airlines, nonstop, time-of-day) and optional ground-shuttle pairing. Uses SerpAPI Google Flights (or WebSearch fallback). Saves preferences to `~/.flight-planner/config.json` and logs every search.
disable-model-invocation: true
---

# Flight Planner

A deterministic flight search and ranking pipeline. The user supplies their trip (dates + origin + destination) every run; everything else (budget, airlines, time windows, optional shuttle) comes from a saved preferences config so repeat searches are fast.

The math (filtering, pricing, shuttle buffer calculation) runs in Python scripts — never eyeballed by the LLM — so results are reproducible. The LLM's job is orchestration and presentation.

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
- `scripts/fetch_flights.py` — SerpAPI Google Flights wrapper
- `scripts/filter_flights.py` — Filter, rank, and cluster-analyze results
- `scripts/pair_shuttles.py` — Optional: pair flights with a ground shuttle
- `references/config_schema.md` — Full config.json field reference
- `references/flight_history_schema.md` — Flight log format reference
- `references/shuttle_schedules.md` — Template + how-to for users with a local shuttle

## Persistent state (not in the skill directory)

- `~/.flight-planner/config.json` — User preferences. Created via first-run wizard. Never overwritten by skill installer.
- `~/.flight-planner/flight_history.json` — Append-only log of searches and selections.

`~` expands to `%USERPROFILE%` on Windows and `$HOME` on Mac/Linux.

## Workflow — four phases

Run these in order every time. Do not skip Phase 2 even if the config looks right.

### Phase 0 — Setup check (deterministic, runs on skill load)

The fenced command below runs automatically when the skill is invoked. Read its output before doing anything else — it tells you the user's setup state without you having to ask.

```!
bash ~/.claude/skills/estack-flight-planner/scripts/check_setup.sh
```

The output reports:
- Today's date and local timezone (use this when converting relative dates in Phase 1)
- Whether `~/.flight-planner/config.json` exists, and if so, all current preferences (with the SerpAPI key masked to "set" or "null")
- Whether `SERPAPI_KEY` is set in the environment
- Whether `~/.flight-planner/flight_history.json` exists and how many entries it has

**Decision tree based on output:**
- **Config exists** → Phase 1 (ask trip details), then Phase 2 in confirmation mode (show saved prefs, ask "still right?")
- **Config missing** → Phase 1 (ask trip details), then Phase 2 in wizard mode (walk through each preference, offer to save at end)
- **Config exists but `serpapi_key: null` AND no env var** → tell the user up front that you'll use the WebSearch fallback in Phase 3 Step 2, with the caveat about coverage

Don't repeat back the setup output to the user verbatim — just internalize it and adapt your behavior.

**After Phase 0 finishes, present an overview to the user before Phase 1:**

Tell the user, in your own words:
- What this skill does: finds and ranks flights between any two airports using their preferences.
- How it works: 4 phases — (1) Trip details (where/when), (2) Preferences (confirm saved config or run a first-run wizard), (3) Run the search pipeline (fetch → filter → rank → optional shuttle pairing), (4) Recommend and log.
- Where state lives: `~/.flight-planner/config.json` (preferences) and `~/.flight-planner/flight_history.json` (search log).
- Whether they're in first-run wizard mode or returning-user mode (based on Phase 0 output).

**Pacing for Phase 2 wizard (first-run only):** If Phase 0 showed no config, the user will face a multi-question wizard in Phase 2. Right after the overview, ask once: "When we get to your preferences setup, do you want me to ask all questions one at a time, or batch them so you can answer in one message?" Skip this question entirely if a config already exists (returning user — Phase 2 is just confirmation).

### Phase 1 — Trip details (one question, then a proposed plan)

Per the "boil the ocean" mentality above, **do not ask three separate questions**. Ask ONE open question, then do the work:

**The single question:** "Where are you going and when?" (Wait for answer.)

The user may answer with anything from "May 16-17 IND→EWR" (already precise) to "this weekend Indiana to NJ" (vague). Either way, the next thing you do is **resolve every inferable detail with your tools**, then present a proposed plan.

**Tool steps before you respond:**

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

### Phase 2 — Preferences confirmation

**If `~/.flight-planner/config.json` exists:**

Read it and show a single block:

```
Your saved preferences:
  Budget:           $200 (soft)
  Airlines:         UA, DL (soft)
  Nonstop:          preferred (soft)
  Time priority:    11:00–14:00, 14:00–22:00 (soft)
  SerpAPI key:      set
  Shuttle service:  none

Are these still your preferences? (yes / change <field> / skip)
```

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

5. **SerpAPI key** — "Do you have a SerpAPI key? (yes — paste it / no — explain how to get one / skip — use WebSearch fallback)". See the SerpAPI walkthrough section below.
6. **Optional fields** — "Want to save a home airport so we suggest it next time? (IATA code or 'no')". Same for `frequent_destinations`.
7. **Optional shuttle service** — "Do you use a ground shuttle to your airport that you'd like the skill to pair flights with? (yes / no)". If yes, ask for company name + schedule URL(s). See shuttle setup below.

After collecting answers, show the full config and ask "Save this to ~/.flight-planner/config.json?" before writing.

### Phase 3 — Execute

Run the scripts. Do all math via the scripts, never in your head.

**Step 1 — Log search start**

Append a `search_started` entry to `~/.flight-planner/flight_history.json` with timestamp, dates, route, and a snapshot of the preferences used (after Phase 2 overrides). See `references/flight_history_schema.md` for the exact format.

**Step 2 — Fetch live flight data**

If the user has a SerpAPI key:

```bash
python scripts/fetch_flights.py \
  --dates 2026-05-09,2026-05-10 \
  --routes IND-EWR,ORD-LGA \
  --airlines UA,DL \
  --stops 1
```

Pass `--airlines` only if the user has airline preferences. Pass `--stops 1` only if `nonstop_preference` is `required` or `preferred` with `hard` strength. Omit both for "any airline, any stops".

The script reads `SERPAPI_KEY` from the environment or accepts `--api-key`. Saves raw JSON to a temp directory and prints the directory path on stdout — capture this for the next step.

**If the user has no SerpAPI key:** Use WebSearch to query flight prices for each route × date combination. Tell the user up front: "Without a SerpAPI key, results will be less comprehensive — I'll search the web for each route but won't have structured price/time data." Build a JSON file in the same shape `fetch_flights.py` would produce so the downstream scripts work unchanged. If you're not confident the WebSearch results are reliable, say so and recommend they get a key.

**Step 3 — Filter and rank flights**

```bash
python scripts/filter_flights.py \
  --json-dir <temp-dir-from-step-2> \
  --max-price 200 \
  --time-priority "11:00-14:00,14:00-22:00" \
  --from IND,ORD \
  --to EWR,LGA \
  --soft-filters max-price,time-priority
```

Pass `--soft-filters` listing every preference whose strength is `soft` — those become rank weights instead of hard filters. Pass all hard preferences as strict filters with no `--soft-filters` entry.

The script outputs filtered flights as JSON to stdout. Capture it for step 5.

**Step 4 — Handle empty results (constraint relaxation)**

If `filter_flights.py` returns `[]`, rerun with `--cluster-analysis`:

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

Fetch the user's shuttle schedule URLs (from config) with WebFetch in parallel. Build a `shuttles.json` file matching the schema in `references/shuttle_schedules.md`. Then:

```bash
python scripts/pair_shuttles.py \
  --flights-json <filtered-output-from-step-3> \
  --shuttles-json <shuttles-file> \
  --shuttle-costs "IND:30,ORD:60"
```

`--shuttle-costs` is a comma-separated `AIRPORT:USD` list from the user's `shuttle_service.costs` config field. Outputs a markdown ranked plans table. Show it to the user.

**Step 6 — Present results**

- If pairing was done: show the markdown table from `pair_shuttles.py` directly.
- If no shuttle: print a flights-only table with Date | Flight | Route | Departs | Arrives | Price | Airline | Stops | Soft-filter notes.

Recommend the top row in one or two sentences. Ask which flight they want to book.

**Step 7 — Log the selection**

When the user confirms a choice, append a `selection_made` entry to `~/.flight-planner/flight_history.json`, linking back to the `search_started` entry from step 1. See `references/flight_history_schema.md`.

**Step 8 — Offer booking link**

Offer to open the airline's booking page. For most airlines a generic Google Flights link works:

```
https://www.google.com/travel/flights?q=Flights%20from%20<DEP>%20to%20<ARR>%20on%20<DATE>
```

## SerpAPI walkthrough

If the user doesn't have a SerpAPI key and asks for help getting one:

1. Tell them: "SerpAPI gives the skill structured Google Flights data. Free tier is 100 searches/month — usually enough for personal trip planning. Paid plans start at $50/month."
2. Walk them to https://serpapi.com/users/sign_up — sign up with email.
3. After signup, the API key is at https://serpapi.com/manage-api-key.
4. To set it permanently, walk them through either:
   - Saving it in their flight-planner config (`serpapi_key` field), or
   - Setting `SERPAPI_KEY` as an environment variable in their shell profile.
5. If they don't want a key: confirm they want the WebSearch fallback. Set `serpapi_key: null` in config. Tell them: "I'll use WebSearch each run. Results won't be as complete and prices may be approximations."

## Important behaviors

**Always run the scripts.** Don't summarize flights from memory. If the conversation has stale flight data from a previous run, re-fetch.

**Strength matters.** Hard filters exclude; soft filters rank. Pass soft filters via `--soft-filters` to keep non-matching results visible.

**No shuttle data ships with this skill.** Each user provides their own shuttle service info in their config. The skill scrapes their schedule URLs at search time.

**Origin and destination are not saved by default.** Only save them if the user explicitly opts in.

**Two log entries per search.** Entry 1 on fetch (step 1), entry 2 on selection (step 7). Both are written even if the user abandons mid-search — the search_started entry preserves what they were looking for.

**Times in the config are 24-hour HH:MM format.** Display them in 12-hour to the user but store 24-hour.

---

## Skill Feedback

If the user shares feedback about this skill — a bug, something confusing, a missing feature, or a suggestion — ask them to describe it in a bit more detail (what they expected, what happened, and any relevant context). Then build a pre-filled GitHub issue URL and share it so the user can click, review, and submit:

```bash
python3 -c "
import urllib.parse
title = 'estack-flight-planner: <concise summary>'
body = '<description from user feedback — expected vs. actual behavior and context>'
base = 'https://github.com/ElliotDrel/e-stack/issues/new'
print(base + '?title=' + urllib.parse.quote(title) + '&body=' + urllib.parse.quote(body))
"
```

Share the printed URL with the user. They click it, review the pre-filled title and body, then click **Submit new issue**.

## Adding a shuttle service to your config

If you regularly use a shuttle to your airport, add it to your config so the skill pairs flights with shuttle runs automatically:

```json
"shuttle_service": {
  "name": "Your Shuttle Co.",
  "schedule_urls": ["https://yourshuttle.example.com/schedule"],
  "costs": {"ORD": 60, "MDW": 55},
  "home_timezone": "America/New_York",
  "airport_timezones": {"ORD": "America/Chicago", "MDW": "America/Chicago"}
}
```

See `references/shuttle_schedules.md` for the full schema, JSON format the pairing script expects, and tips on extracting schedule data from a shuttle company's website.

---

## Skill Feedback
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
