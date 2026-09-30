#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
echo "7fac1b420ea4c8533294861511263f2cf3ec2addfbfcfa458a3e94f54cbd9404  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs" | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs
current=$(sha256sum /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs | cut -d " " -f 1)
[[ "$current" == "7fac1b420ea4c8533294861511263f2cf3ec2addfbfcfa458a3e94f54cbd9404" || "$current" == "7fac1b420ea4c8533294861511263f2cf3ec2addfbfcfa458a3e94f54cbd9404" ]] || { echo "Installed file changed: /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs"; exit 1; }
echo "07519e6e0d84018ff3dc760bd06820cd15959c7da256e098230b20d2e653c98a  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs" | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs
current=$(sha256sum /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs | cut -d " " -f 1)
[[ "$current" == "596a76bdbbeb07c67ea366e1c59bf62be7010607b85df414191842637902d6ad" || "$current" == "07519e6e0d84018ff3dc760bd06820cd15959c7da256e098230b20d2e653c98a" ]] || { echo "Installed file changed: /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs"; exit 1; }
echo "fc8a20e7cebf23862d91a21d158350d8d94e9ceb068f260d618611de3ea3d4e5  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/agent-run-control-shared.patched.mjs" | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/agent-run-control-shared.patched.mjs
current=$(sha256sum /usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs | cut -d " " -f 1)
[[ "$current" == "37fea68b3fa031c964569259b60b7ac71721d2349bcaa8f8a92b7fdc815f156a" || "$current" == "fc8a20e7cebf23862d91a21d158350d8d94e9ceb068f260d618611de3ea3d4e5" ]] || { echo "Installed file changed: /usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs"; exit 1; }
echo "badce58c2a748226dbb86cdda1496b6f10b18e33301e4e92e580dc386bfced91  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/codex-thread-lifecycle.patched.js" | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/codex-thread-lifecycle.patched.js
current=$(sha256sum /home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js | cut -d " " -f 1)
[[ "$current" == "badce58c2a748226dbb86cdda1496b6f10b18e33301e4e92e580dc386bfced91" || "$current" == "badce58c2a748226dbb86cdda1496b6f10b18e33301e4e92e580dc386bfced91" ]] || { echo "Installed file changed: /home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js"; exit 1; }
stamp=$(date +%Y%m%d-%H%M%S)
cp -p -- /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs "/usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs.before-responsive-$stamp"
cat /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs > /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs
cmp /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs
cp -p -- /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs "/usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs.before-responsive-$stamp"
cat /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs > /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs
cmp /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs
cp -p -- /usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs "/usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs.before-responsive-$stamp"
cat /home/ilbert/.openclaw/workspace/projects/friday-miniapp/agent-run-control-shared.patched.mjs > /usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs
cmp /home/ilbert/.openclaw/workspace/projects/friday-miniapp/agent-run-control-shared.patched.mjs /usr/lib/node_modules/openclaw/dist/agent-run-control-shared-DXVEJ-0Y.mjs
cp -p -- /home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js "/home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js.before-responsive-$stamp"
cat /home/ilbert/.openclaw/workspace/projects/friday-miniapp/codex-thread-lifecycle.patched.js > /home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js
cmp /home/ilbert/.openclaw/workspace/projects/friday-miniapp/codex-thread-lifecycle.patched.js /home/ilbert/.openclaw/npm/projects/openclaw-codex-8902d781d4/node_modules/@openclaw/codex/dist/thread-lifecycle-DXl1-I6b.js
uid=$(id -u ilbert)
user_run() { runuser -u ilbert -- env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" "$@"; }
user_run systemctl --user restart openclaw-gateway.service
for attempt in {1..30}; do
  if user_run openclaw health --timeout 3000 >/dev/null 2>&1 && curl -fsS --max-time 5 https://friday-live-8k0kga.nibrun.app/healthz | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("bridgeConnected") else 1)'; then
    echo "All four patches installed. Gateway and voice bridge healthy. Start a new voice session; spoken behavior still needs a live test."
    exit 0
  fi
  sleep 2
done
echo "Patches installed, but recovery verification failed. Inspect Gateway logs."
exit 1
