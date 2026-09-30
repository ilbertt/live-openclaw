# Friday Telegram Mini App

Source snapshot: 30 September 2026. A Bun-powered Telegram Mini App for live voice with an OpenClaw agent. Includes the public relay, local outbound connector, UI, bbot face, fading captions, tilt-driven gaze, and the version-specific OpenClaw patch history.

## Architecture

```text
Telegram Mini App -- audio/WebRTC --> OpenAI Live
        |
        +-- authenticated WSS --> Bun relay on nibrun
                                      ^
                                      | outbound WSS
                               local connector
                                      |
                               local OpenClaw Gateway
```

The relay validates Telegram's signed identity and allows a single configured user. The connector allows only the Talk catalog/create/close/steer methods plus the scoped WebRTC SDP exchange. It currently requests operator.read, operator.talk and operator.write for delegated agent work.

The UI uses @bwnd/bbot 0.5.0, with orange skin, dark eyes and no mouth. Captions show eight words, hold for 2.4 seconds, then fade over 650ms. Telegram DeviceOrientation drives local gaze; unsupported sensors fall back to idle animation. Sensor data is not uploaded. The Live badge requires relay/Gateway readiness and connected WebRTC. Audio playback uses the existing HTML audio element.

## Requirements

- Bun (build and runtime), Node.js (regression tests).
- An OpenClaw installation providing the Talk RPCs and `gpt-live-1-codex` adapter used by this snapshot. This is not a standalone OpenAI API client; arbitrary/newer OpenClaw versions may not be compatible.
- A Telegram bot with a menu-button Mini App, and a public HTTPS deployment.
- nibrun CLI (`nib`) for the deployment instructions below.

## Install and check

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

The build embeds the UI and bundled face library in `dist/friday-miniapp`, a Linux x64 executable. Dependencies and the executable are intentionally not included in this source archive.

## Configuration

Copy `.env.example` to `.env` locally and fill in the values. Use an independently generated, high-entropy shared secret: server `BRIDGE_SECRET` and connector `FRIDAY_MINIAPP_BRIDGE_SECRET` must match. Never publish the `.env` file. The connector can read the local Gateway token from OpenClaw config; do not expose it to the browser or public relay.

This is a snapshot of Luca's personal app, not a generalized template. Before using another bot/account, edit `SESSION_KEY` in `src/web/index.html.txt` to the correct OpenClaw session route. Set `TELEGRAM_BOT_ID` and `TELEGRAM_ALLOWED_USER_ID` for that bot/user; the source retains the original non-secret identity defaults. Model choice is also in that HTML file. The voice is configured in OpenClaw, not overridden by the browser.

Run the relay and connector as separate processes:

```sh
bun run start
# In a second terminal, with the connector environment configured:
bun run connector
```

Serve over HTTPS and open through Telegram to supply valid signed `initData`. Opening in an ordinary browser displays the page but does not authenticate voice access. Microphone permission is required. Do not replace real authentication with mocked test data.

## Deploy

```sh
bun run build
nib login
nib run ./dist/friday-miniapp --app YOUR_EXISTING_APP --port 3000
```

Configure the relay environment on nibrun using its environment settings; a local `.env` file is not embedded in the binary. Set the connector's `FRIDAY_MINIAPP_URL` to the public URL, then run/restart the connector on the Gateway machine. Register that URL as the Telegram bot's Mini App menu button. `/healthz` reports relay, bridge and Gateway readiness (not proof of audible playback).

No systemd service, credentials, bot setup, account access, or OpenClaw installation is bundled. The existing connector keeps an outbound WebSocket open and may prevent the nibrun deployment sleeping.

## OpenClaw patches and historical scripts

`patches/responsive-merged/` contains the latest three-file merged responsiveness patch and its hash manifest. `patches/end-conversation/` and root-level `.original`, `.before-*`, `.patched`, installer and restart files preserve development history. They are **not additive interchangeable installers**: older installers can regress newer changes.

Do not run historical installers/restart scripts blindly. They target exact OpenClaw distribution filenames/hashes, contain original machine paths/service names and Telegram delivery routes, and some restart the Gateway. Inspect and adapt them first. For the original machine, `install-responsive-merged.sh` installs/verifies only and deliberately does not restart.

`bun run check` runs portable TypeScript, tilt, follow-up-retention and merged-controller tests. Additional `test-close-merged.mjs` and `test-conversation-close.mjs` require the matching installed OpenClaw distribution; other tests are historical revision checks.

## Important behavior and limits

- Closing on a farewell uses an application-defined structured control request, not a native OpenAI emotion/hang-up event. Live choosing that request reliably remains unverified; the End button always remains available.
- Cosmetic emotional expressions currently include simple transcript heuristics. They are not emotion detection and can misfire.
- Simulated browser/sensor checks do not prove physical-phone sensor behavior, audio routing, or end-to-end voice latency.
- Face assets use content-hashed URLs. Do not revert to a fixed script URL: the public CDN was observed caching JavaScript for four hours, causing HTML/module version mismatches.
- Do not remove the error boundary around optional tilt startup; sensors must not block voice initialization.
- This prototype does not include production rate limiting or a Telegram initData replay cache. Review before sharing access.

## Included / excluded

Included: source, lockfile, bundled browser asset, tests, patch manifests/snapshots, historical helper scripts, voice prompt, setup documentation, and a clean local Git history.

Excluded: node_modules, compiled binary, process logs, private chat/memory files, real `.env` files, Gateway/bot credentials, and the surrounding workspace/repository history. This repository has no remote and has not been published to GitHub.

## Third-party code

bbot and OpenClaw packages/patch snapshots retain their respective upstream licensing. See `THIRD_PARTY_NOTICES.md`. No new blanket license is asserted over the bundled third-party code.
