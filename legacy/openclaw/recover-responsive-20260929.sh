#!/usr/bin/env bash
set -u
exec >>/home/ilbert/.openclaw/workspace/projects/friday-miniapp/logs/recover-responsive-20260929.log 2>&1
old_pid=$(systemctl --user show openclaw-gateway.service -p MainPID --value)
date -Is
systemctl --user restart --no-block openclaw-gateway.service || exit 1
for attempt in {1..100}; do
  sleep 5
  pid=$(systemctl --user show openclaw-gateway.service -p MainPID --value)
  if [[ "$pid" != "$old_pid" && "$pid" != 0 ]] && systemctl --user is-active --quiet openclaw-gateway.service && timeout 12 openclaw health --timeout 3000 >/dev/null 2>&1; then
    if curl -fsS --max-time 8 https://friday-live-8k0kga.nibrun.app/healthz | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("bridgeConnected") else 1)'; then
      date -Is
      openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the Gateway has restarted and passed its health check; the voice bridge is connected. The three merged patches are installed and loaded. Reopen the Mini App for a new session: ask for a search, then ask a follow-up while it runs. The lost-question fix and reduced delay passed code checks; real voice responsiveness still needs this test.'
      exit $?
    fi
  fi
done
openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the restart recovery check timed out. Gateway/bridge recovery is not verified; the check log is saved locally. Do not rerun the installer.'
exit 1
