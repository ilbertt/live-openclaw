#!/usr/bin/env bash
set -u
sleep 8
if systemctl --user restart openclaw-gateway.service; then
  for attempt in $(seq 1 30); do
    if openclaw health --timeout 3000 >/dev/null 2>&1; then
      openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the Gateway has restarted and its health check passes. The five-second progress-update patch is now loaded. Reopen the Mini App and start a new conversation. Spoken update timing, goodbye auto-end, and reminder creation by voice still need a live test. Your existing 19:30 reminder is already scheduled.'
      exit $?
    fi
    sleep 2
  done
fi
openclaw message send --channel telegram --target 397420856 --thread-id 353435 --message 'Luca, the Gateway restart recovery check failed. Voice recovery is not verified; the restart supervisor log is available locally.'
exit 1
