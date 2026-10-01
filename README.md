# Live OpenClaw

A private Telegram Mini App for live voice with an OpenClaw agent. Refactored from the Friday snapshot of 30 September 2026 using the workspace layout and layering of [telegram-bot-starter](https://github.com/ilbertt/telegram-bot-starter) at `0520ace`.

```text
Telegram Mini App ── audio/WebRTC ── OpenAI Live
       │
       └── authenticated WSS ── public Bun relay
                                    ▲
                                    │ outbound WSS
                             local connector ── OpenClaw Gateway
```

The relay verifies Telegram's Ed25519 signature, launch age, and allowed user. The connector forwards only the four Talk RPC methods and SDP offers within the Gateway's `/plugins/openai/` subtree. Audio travels over WebRTC; orientation stays on the phone.

## Structure

```text
backend/
  src/main.ts                  Relay entry point
  src/app.ts                   HTTP and WebSocket composition
  src/routes/                  Thin HTTP/WebSocket controllers
  src/services/                Authentication, relay state, assets, Gateway, SDP
  src/repositories/            Asset and local credential reads
  src/services/container.ts    Shared relay service instances
  src/connector/               Local connector entry point and transport
  src/protocol.ts               Browser-safe wire types and runtime guards
  test/                        Auth, protocol, real socket and HTTP regressions
miniapp/
  src/components/              Face, captions, connection, call controls
  src/lib/hooks/               React lifecycle and caption state
  src/lib/voice/               Call lifecycle, audio, events, structured closing
  src/lib/face/                Animation and Telegram orientation
  test/                        Voice lifecycle, tilt, closing, RTP regressions
scripts/                       Workspace dev/build/check orchestration
patches/                       Version-specific OpenClaw patch snapshots
legacy/openclaw/               Historical installers, revisions and documentation
```

Backend imports use `#*` with `.ts`; frontend imports are relative. The frontend imports wire types and guards through `backend/protocol`. HTTP routes use Elysia schemas; native Bun WebSockets retain the original relay protocol. There is no bot polling or database: OpenClaw already owns bot interactions and conversation persistence.

## Requirements and configuration

Use Bun 1.4.1 or newer. The Gateway must provide the Talk RPCs and `gpt-live-1-codex` adapter from the supplied snapshot; arbitrary newer OpenClaw versions may be incompatible. You also need a Telegram bot Mini App and a public HTTPS URL.

```sh
bun install --frozen-lockfile
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `BRIDGE_SECRET` | Relay | Independently generated, high-entropy shared secret |
| `TELEGRAM_BOT_ID` | Relay | Bot's numeric ID, without its token |
| `TELEGRAM_ALLOWED_USER_ID` | Relay | Single allowed Telegram user |
| `OPENCLAW_SESSION_KEY` | Relay | Existing OpenClaw agent/session route |
| `VOICE_MODEL` | Relay | Defaults to `gpt-live-1-codex` |
| `PORT` | Relay | Defaults to `NIBRUN_HTTP_PORT`, then `3000` |
| `FRIDAY_MINIAPP_BRIDGE_SECRET` | Connector | Must match the relay secret |
| `FRIDAY_MINIAPP_URL` | Connector | Public relay HTTP(S) URL |
| `OPENCLAW_GATEWAY_URL` | Connector | Defaults to `ws://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Connector | Optional explicit Gateway credential |
| `OPENCLAW_CONFIG_PATH` | Connector | Optional path; defaults to `~/.openclaw/openclaw.json` |

The connector reads its Gateway token from local configuration or the OpenClaw CLI when no token is supplied. Credentials never reach the frontend. The public `/api/config` endpoint exposes only the non-secret session route and voice model.

For migration from the snapshot, move the old root `.env` to `backend/.env` and set `OPENCLAW_SESSION_KEY` to the route previously hardcoded in the HTML. The original bot and user defaults have been removed. The connector now requires an explicit shared secret; it no longer derives one from a bot token.

## Run and verify

```sh
bun dev                    # Relay plus Vite frontend
bun run connector          # Separate process on the Gateway machine
bun check:all              # Strict backend/frontend types and Biome
bun test                   # Portable regressions and real local socket tests
bun run build:local        # Host binary at backend/dist/app
bun run build              # Linux x64 binary at backend/dist/app
```

Vite proxies `/api` and `/rpc` to the relay at port 3000. If you change the development relay port, update the proxy target in `miniapp/vite.config.ts`. Telegram requires HTTPS and signed launch data; a plain browser can preview the UI but cannot start a call. Register your public URL as the bot's Mini App menu button.

For a single-process local preview, build first, then run `bun start`. Build scripts embed Vite's content-hashed frontend assets in the relay binary. `miniapp/` remains removable: backend checks/builds still work, and no SPA fallback is served without an embedded index. The connector runs from source on the local Gateway machine; it is separate from the public relay binary.

## Deployment

```sh
bun run build
nib run ./backend/dist/app --app YOUR_EXISTING_APP --port 3000
```

Set relay variables on the host: local `.env` files are not compiled into the binary. Run the connector on the Gateway machine with its variables configured. `/healthz` reports relay, bridge and Gateway readiness. It does not prove audible playback or end-to-end voice latency. This repository does not install services, change your bot, or apply Gateway patches automatically.

## Preserved behavior and OpenClaw patches

The orange bbot face, dark eyes, no mouth, eight-word captions, 2.4-second hold, 650 ms fade, optional Telegram tilt gaze, microphone processing, audio-element playback, mute/end controls, and structured farewell closing are preserved. Live status requires both relay/Gateway readiness and a connected WebRTC peer. Ending during startup cancels pending work and releases late microphone streams; disconnected RPCs reject immediately.

`patches/responsive-merged/` retains the merged responsiveness patches and manifests. `patches/end-conversation/` retains the farewell-control patch. Their portable regression scripts live in `patches/tests/` and run through `bun test`.

`legacy/openclaw/` contains the original revision history, installer/restart scripts and README. These files are archival; their old relative paths and machine-specific paths have not been adapted for execution. Inspect and adapt them before use. Older patch installers can overwrite newer behavior. See [third-party notices](THIRD_PARTY_NOTICES.md) and `licenses/` for upstream licensing.

Structured closing depends on a model-issued `end_conversation` control and silent output telemetry; transcripts are not classified as farewell commands. The End button always remains available. Cosmetic transcript expressions are heuristics. The app remains a single-user prototype without rate limiting or an init-data replay cache. Automated tests do not prove phone microphone/sensor behavior or compatibility with a particular live Gateway installation.
