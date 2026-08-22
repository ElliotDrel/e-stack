#!/usr/bin/env bash
# Deterministic setup check. Run at skill load time via the ```! fence in SKILL.md.
# Outputs a human-readable report of:
#   - whether ~/.e-stack/estack-flight-planner/config.json exists and its contents (key masked)
#   - whether ~/.e-stack/estack-flight-planner/flight_history.json exists and its entry count
#   - today's date (for resolving relative dates in Phase 1)
#   - whether SERPAPI_KEY env var is set
# No side effects. Safe to run on every skill invocation.

set -u

CONFIG_DIR="$HOME/.e-stack/estack-flight-planner"
CONFIG_FILE="$CONFIG_DIR/config.json"
HISTORY_FILE="$CONFIG_DIR/flight_history.json"

# State moved from ~/.flight-planner to ~/.e-stack/estack-flight-planner, so
# every e-stack skill keeps its files in one place. An install that predates
# the move still has the old folder. Report it rather than moving it: the
# config holds an API key, and silently relocating a user's file is not this
# script's call. Without this the skill would find nothing and open the
# first-run wizard, and the user would retype preferences they already set.
LEGACY_DIR="$HOME/.flight-planner"

echo "=== Flight Planner Setup ==="
echo "Today: $(date +%Y-%m-%d)  (timezone: $(date +%Z))"
echo ""

# --- Config ---
if [ -f "$CONFIG_FILE" ]; then
  echo "Config:      $CONFIG_FILE (exists)"
  echo ""
  echo "--- Saved preferences ---"
  # Mask serpapi_key value: show as "set" or "null" but never the actual key.
  # The file is piped in on stdin rather than passed as a path: under Git Bash
  # on Windows, $HOME is a POSIX path (/c/Users/...) that a native Windows
  # Python cannot open, so a path argument silently fails here.
  python -c "
import json, sys
try:
    c = json.load(sys.stdin)
except Exception as e:
    print(f'  ERROR reading config: {e}')
    sys.exit(0)

key = c.get('serpapi_key')
print('  SerpAPI key:           ' + ('set' if key else 'null (will use WebSearch fallback)'))
print('  Budget:                \$' + str(c.get('budget_usd', '?')) + ' (' + str(c.get('budget_strength', '?')) + ')')
airlines = c.get('airline_preferences') or []
print('  Airlines:              ' + (', '.join(airlines) if airlines else 'any') + ' (' + str(c.get('airline_preference_strength', '?')) + ')')
np = c.get('nonstop_preference', '?')
ns = c.get('nonstop_strength', '?')
print('  Nonstop:               ' + str(np) + ' (' + str(ns) + ')')
bands = c.get('time_priority_bands') or []
print('  Time priority:         ' + (', '.join(bands) if bands else 'none') + ' (' + str(c.get('time_priority_strength', '?')) + ')')
dur = c.get('max_duration_min')
print('  Max duration:          ' + (str(dur) + ' min (' + str(c.get('max_duration_strength', '?')) + ')' if dur else 'no limit'))
print('  Home airport:          ' + str(c.get('home_airport') or 'not set'))
freq = c.get('frequent_destinations') or []
print('  Frequent destinations: ' + (', '.join(freq) if freq else 'not set'))

presets = c.get('trip_presets') or {}
if presets:
    print('')
    print('--- Trip presets (name one and skip airport research) ---')
    for slug, p in presets.items():
        origins = ','.join(p.get('origins') or []) or '?'
        dests = ','.join(p.get('destinations') or []) or '?'
        label = p.get('label') or slug
        legs = p.get('shuttle_legs') or 'not set'
        ride = {'departure': 'ride TO the departure airport',
                'arrival': 'ride FROM the arrival airport',
                'both': 'ride on BOTH ends',
                'none': 'no ride needed'}.get(legs, 'shuttle legs not set - ask')
        print('  ' + slug + ': ' + label + '  [' + origins + ' -> ' + dests + ']')
        print('      usually: ' + ride + '  (CONFIRM THIS OUT LOUD every run)')
        aliases = p.get('aliases') or []
        if aliases:
            print('      also matches: ' + ', '.join(aliases))
        if p.get('notes'):
            print('      note: ' + str(p['notes']))
else:
    print('  Trip presets:          none saved')

print('')
shuttle = c.get('shuttle_service')
if shuttle:
    providers = shuttle.get('providers')
    if providers:
        names = ', '.join(str(pr.get('name', '?')) for pr in providers)
    else:
        names = str(shuttle.get('name', '?'))
    costs = shuttle.get('costs', {}) or {}
    cost_str = ', '.join(f'{k} \${v}' for k, v in costs.items()) if costs else 'no costs configured'
    print('--- Shuttle service ---')
    print('  Providers:             ' + names)
    print('  Home:                  ' + str(shuttle.get('home_label') or shuttle.get('home_timezone') or 'not labeled'))
    print('  Costs (one way):       ' + cost_str)
    print('  Buffers:               pre-flight ' + str(shuttle.get('min_buffer_min', 90)) +
          ' min, post-flight ' + str(shuttle.get('min_connect_min', 60)) +
          ' min, max wait ' + str(shuttle.get('max_wait_min', 240)) + ' min')
    lead = shuttle.get('reservation_lead_hours')
    if lead:
        print('  Reservation lead:      ' + str(lead) + ' h')
    urls = []
    for pr in (providers or [shuttle]):
        urls += list(pr.get('schedule_urls') or [])
    print('  Schedule URLs:         ' + (str(len(urls)) + ' to fetch at search time' if urls else 'NONE - pairing cannot run'))
else:
    print('  Shuttle service:       none (pairing step will be skipped)')
" < "$CONFIG_FILE" 2>&1 || echo "  (python not available; cannot parse config — read the file directly)"
elif [ -f "$LEGACY_DIR/config.json" ]; then
  echo "Config:      $CONFIG_FILE (NOT FOUND)"
  echo ""
  echo "!! Config found at the OLD location: $LEGACY_DIR"
  echo "   State moved to ~/.e-stack/estack-flight-planner so every e-stack skill"
  echo "   keeps its files in one folder. Do NOT run first-run setup — move the"
  echo "   existing files instead, then re-run this check:"
  echo ""
  echo "     mkdir -p \"$CONFIG_DIR\" && mv \"$LEGACY_DIR\"/* \"$CONFIG_DIR\"/ && rmdir \"$LEGACY_DIR\""
  echo ""
  echo "   Ask the user to confirm before moving anything: config.json holds their"
  echo "   SerpAPI key and flight_history.json is an append-only log."
else
  echo "Config:      $CONFIG_FILE (NOT FOUND)"
  echo ""
  echo "First-run setup is needed. The skill will walk the user through Phase 2"
  echo "to create this file."
fi

echo ""

# --- Environment SERPAPI_KEY ---
if [ -n "${SERPAPI_KEY:-}" ]; then
  echo "SERPAPI_KEY: set in environment (will be used if config key is null)"
else
  echo "SERPAPI_KEY: not set in environment"
fi

echo ""

# --- Flight history ---
if [ -f "$HISTORY_FILE" ]; then
  count=$(python -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(len(data) if isinstance(data, list) else 0)
except Exception:
    print(0)
" < "$HISTORY_FILE" 2>/dev/null || echo "?")
  echo "History:     $HISTORY_FILE ($count entries)"
else
  echo "History:     $HISTORY_FILE (not created yet — first search will create it)"
fi
