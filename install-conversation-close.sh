#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run this installer with sudo in your own terminal.'; exit 1; }
base=/home/ilbert/.openclaw/workspace/projects/friday-miniapp
python3 - "$base" <<'PY'
from pathlib import Path
import hashlib,json,sys,subprocess,shutil,datetime,os
source=Path(sys.argv[1])/'patches/end-conversation';target=Path('/usr/lib/node_modules/openclaw/dist')
manifest=json.loads((source/'manifest.json').read_text()); digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
allowed={'realtime-quicksilver-instructions-kTl3roXd.mjs','realtime-quicksilver-delegation-controller-1v5hW2XF.mjs','realtime-quicksilver-session-BWooKpPG.mjs','talk-DLn5zMng.mjs'}
assert {m['name'] for m in manifest}==allowed
for m in manifest:
 src=source/m['name'];dst=target/m['name']
 if digest(src)!=m['after']:raise SystemExit('Staged patch changed: '+m['name'])
 if digest(dst) not in (m['before'],m['after']):raise SystemExit('Installed version changed; regenerate patches before installing: '+m['name'])
 subprocess.run(['node','--check',str(src)],check=True)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
changed=[]
try:
 for m in manifest:
  src=source/m['name'];dst=target/m['name']
  if digest(dst)==m['after']:continue
  backup=Path(str(dst)+'.before-conversation-close-'+stamp)
  shutil.copy2(dst,backup);changed.append((dst,backup))
  tmp=Path(str(dst)+'.install-conversation-close');shutil.copyfile(src,tmp);os.chmod(tmp,0o644);os.replace(tmp,dst)
  assert digest(dst)==m['after']
except BaseException:
 for dst,backup in reversed(changed):shutil.copy2(backup,dst)
 raise
print('Four patches installed and verified; backups use .before-conversation-close-'+stamp)
PY
uid=$(id -u ilbert)
user_run() { runuser -u ilbert -- env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" "$@"; }
user_run systemctl --user restart openclaw-gateway.service
user_run systemctl --user restart friday-miniapp-bridge.service
for attempt in {1..30}; do
  if user_run openclaw health --timeout 3000 >/dev/null 2>&1 && curl -fsS --max-time 5 https://friday-live-8k0kga.nibrun.app/healthz | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("bridgeConnected") else 1)'; then
    echo 'Gateway and bridge healthy. Open a NEW voice session. Model-issued close behavior still needs a spoken test.'
    exit 0
  fi
  sleep 2
done
echo 'Patches installed, but recovery was not verified. Inspect Gateway logs.'
exit 1
