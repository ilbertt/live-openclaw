#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run this installer with sudo."; exit 1; }
printf '%s\n' '7fac1b420ea4c8533294861511263f2cf3ec2addfbfcfa458a3e94f54cbd9404  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs' | sha256sum --check --status
printf '%s\n' '922c72b73428417e19ce0a82dea7a60f16ddd6dd0d0f85327c13d18ec713ae29  /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs' | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs
printf '%s\n' '596a76bdbbeb07c67ea366e1c59bf62be7010607b85df414191842637902d6ad  /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs' | sha256sum --check --status
printf '%s\n' '896c21da9e671ed84a0b556adadd5f1875dc88beee3a0e0e64b12ece3e830af8  /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs' | sha256sum --check --status
node --check /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs
cp -p -- /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs.before-friendly-20260921
install -m 644 -- /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs
cmp -- /home/ilbert/.openclaw/workspace/projects/friday-miniapp/voice-instructions.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-instructions-kTl3roXd.mjs
cp -p -- /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs.before-friendly-20260921
install -m 644 -- /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs
cmp -- /home/ilbert/.openclaw/workspace/projects/friday-miniapp/delegation-controller.patched.mjs /usr/lib/node_modules/openclaw/dist/realtime-quicksilver-delegation-controller-1v5hW2XF.mjs
echo 'Both patches installed and verified. Gateway restart still required.'
