#!/usr/bin/env bash
# Deterministic setup check. Run at skill load time via the ```! fence in SKILL.md.
# Outputs a human-readable report of:
#   - whether ~/.flight-planner/config.json exists and its contents (key masked)
#   - whether ~/.flight-planner/flight_history.json exists and its entry count
#   - today's date (for resolving relative dates in Phase 1)
#   - whether SERPAPI_KEY env var is set
# No side effects. Safe to run on every skill invocation.

set -u

CONFIG_DIR="$HOME/.flight-planner"
CONFIG_FILE="$CONFIG_DIR/config.json"
HISTORY_FILE="$CONFIG_DIR/flight_history.json"

echo "=== Flight Planner Setup ==="
echo "Today: $(date +%Y-%m-%d)  (timezone: $(date +%Z))"
echo ""

# --- Config ---
if [ -f "$CONFIG_FILE" ]; then
  echo "Config:      $CONFIG_FILE (exists)"
  echo ""
  echo "--- Saved preferences ---"
  # Mask serpapi_key value: show as "set" or "null" but never the actual key
  python -c "
import json, sys
try:
    with open(r'''$CONFIG_FILE''', encoding='utf-8') as f:
        c = json.load(f)
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
print('  Home airport:          ' + str(c.get('home_airport') or 'not set'))
freq = c.get('frequent_destinations') or []
print('  Frequent destinations: ' + (', '.join(freq) if freq else 'not set'))
shuttle = c.get('shuttle_service')
if shuttle:
    name = shuttle.get('name', '?')
    costs = shuttle.get('costs', {}) or {}
    cost_str = ', '.join(f'{k}: \${v}' for k, v in costs.items()) if costs else 'no costs configured'
    print('  Shuttle service:       ' + str(name) + ' (' + cost_str + ')')
else:
    print('  Shuttle service:       none (pairing step will be skipped)')
" 2>&1 || echo "  (python not available; cannot parse config — read the file directly)"
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
import json
try:
    with open(r'''$HISTORY_FILE''', encoding='utf-8') as f:
        data = json.load(f)
    print(len(data) if isinstance(data, list) else 0)
except Exception:
    print(0)
" 2>/dev/null || echo "?")
  echo "History:     $HISTORY_FILE ($count entries)"
else
  echo "History:     $HISTORY_FILE (not created yet — first search will create it)"
fi
