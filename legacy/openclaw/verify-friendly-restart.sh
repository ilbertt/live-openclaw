#!/usr/bin/env bash
set -u
for attempt in {1..100}; do
  pid=$(systemctl --user show openclaw-gateway.service -p MainPID --value)
  if [[ "$pid" != 1289 && "$pid" != 0 ]] && systemctl --user is-active --quiet openclaw-gateway.service && openclaw health --timeout 3000 >/dev/null 2>&1; then
    if curl -fsS --max-time 8 https://friday-live-8k0kga.nibrun.app/healthz | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("bridgeConnected") else 1)'; then
      openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the Gateway restarted successfully and the voice bridge is connected. Both voice patches are installed: narrower delegation and no repeating waiting-message timer. The conversational instructions are saved too. Reopen the Mini App and start a fresh conversation: try counting, then a weather lookup while continuing to talk. Naturalness and background conversation still need that live test.' && exit 0
    fi
  fi
  sleep 4
done
openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the restart recovery check timed out. Gateway and voice-bridge recovery are not verified; I need to inspect the service logs.'
exit 1
