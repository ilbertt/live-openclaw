# Live OpenClaw

Talk to your OpenClaw agent from a Telegram Mini App, with live voice, captions, and an animated face. Access is restricted to one configured Telegram user.

The app runs as two processes: a public relay that serves the Mini App, and a connector on the machine running your OpenClaw Gateway. The connector opens an outbound connection to the relay, so the Gateway can stay on your local network.

```text
Telegram Mini App ── audio/WebRTC ── OpenAI Live
       │
       └── authenticated WSS ── public relay
                                    ▲
                                    │ outbound WSS
                             local connector ── OpenClaw Gateway
```

## Requirements

- Bun 1.4.1 or newer.
- An OpenClaw Gateway providing the Talk RPCs and `gpt-live-1-codex` adapter.
- A Telegram bot with a Mini App menu button.
- A public HTTPS host for the relay.

## Setup

```sh
bun install --frozen-lockfile
cp backend/.env.example backend/.env
```

Fill in `backend/.env` using the comments in [`.env.example`](backend/.env.example). Choose your bot, allowed user, and OpenClaw session route. Generate a shared secret and use the same value for the relay and connector.

The connector can read the Gateway token from your local OpenClaw configuration or CLI. That token stays on the Gateway machine.

## Deployment

Build the relay and its embedded Mini App into one Linux x64 executable:

```sh
bun run build
```

Deploy `backend/dist/app` to your HTTPS host and configure its relay environment variables there. The binary does not include your `.env` file. For an existing nibrun app:

```sh
nib run ./backend/dist/app --app YOUR_APP --port 3000
```

On the Gateway machine, set the connector variables in `backend/.env`, including your public relay URL, then start the connector:

```sh
bun run connector
```

Keep the connector running while you use the Mini App. Set the bot's Mini App menu button to the relay's HTTPS URL, open it through Telegram, and allow microphone access. The Live indicator appears when the Gateway and voice connection are ready. Use Mute or End to control the call.

The relay's `/healthz` endpoint reports bridge and Gateway readiness.

## OpenClaw compatibility

Talk RPCs and voice adapters vary by OpenClaw version. The patches in [`patches/`](patches/) are version-specific; check their manifests against your installation before applying them. Historical scripts in `legacy/openclaw/` contain machine-specific paths and require adaptation.

Automatic conversation closing requires the Gateway's `end_conversation` control. The End button remains available regardless of that support.

See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency and patch licensing.
