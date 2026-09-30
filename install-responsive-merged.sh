#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run this installer with sudo in your own terminal.'; exit 1; }
base=/home/ilbert/.openclaw/workspace/projects/friday-miniapp
python3 - "$base" <<'PY'
from pathlib import Path
import hashlib,json,sys,subprocess,shutil,datetime,os
source=Path(sys.argv[1])/'patches/responsive-merged';target=Path('/usr/lib/node_modules/openclaw/dist')
manifest=json.loads((source/'manifest.json').read_text()); digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
allowed={'realtime-quicksilver-delegation-controller-1v5hW2XF.mjs', 'realtime-quicksilver-instructions-kTl3roXd.mjs', 'agent-run-control-shared-DXVEJ-0Y.mjs'}
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
  backup=Path(str(dst)+'.before-responsive-merged-'+stamp)
  shutil.copy2(dst,backup);changed.append((dst,backup))
  tmp=Path(str(dst)+'.install-conversation-close');shutil.copyfile(src,tmp);os.chmod(tmp,0o644);os.replace(tmp,dst)
  assert digest(dst)==m['after']
except BaseException:
 for dst,backup in reversed(changed):shutil.copy2(backup,dst)
 raise
print('Three merged patches installed and verified; backups use .before-responsive-merged-'+stamp)
PY
echo "Installation complete. Gateway restart required; no restart was requested by this installer."
