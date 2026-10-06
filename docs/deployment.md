# Deployment and Gateway compatibility

## What runs where

- **nibrun:** the compiled relay and bundled Mini App. Required environment:
  `BRIDGE_SECRET`, `TELEGRAM_BOT_ID`, `TELEGRAM_ALLOWED_USER_ID`,
  `OPENCLAW_SESSION_KEY`; optional `VOICE_MODEL` (default `gpt-live-1-codex`).
  nibrun supplies the HTTP port; this app defaults to 3000 elsewhere.
- **Gateway machine:** the connector, Bun, OpenClaw, and provider credentials.
  Required environment: `FRIDAY_MINIAPP_URL`, `FRIDAY_MINIAPP_BRIDGE_SECRET`.
  Gateway URL defaults to `ws://127.0.0.1:18789`; authentication is resolved from
  local OpenClaw config or `openclaw gateway auth-token --show`, or an explicit
  `OPENCLAW_GATEWAY_TOKEN`. Set `OPENCLAW_CONFIG_PATH` for a non-default config.
- **Telegram:** the allowed user's signed Mini App launch and microphone/audio UI.
  No public Gateway port or bot token is required on the relay.

`backend/.env.example` covers both roles. The relay binary reads its host's
environment; it does not receive the connector's local `.env` automatically.
Generate an independent shared secret and use the same value on both sides.
Keep `.env` files private and untracked. Reuse the existing bot and session route.

## Preflight before deploying

Use the Bun version pinned in the root `package.json`:

```sh
bun install --frozen-lockfile
cp backend/.env.example backend/.env  # only if it does not already exist
chmod 600 backend/.env
# Edit backend/.env for your own Gateway, session route, and connector settings.
openclaw --version
bun run doctor --session
bun run check
bun run build
```

## Gateway compatibility

The session probe requires `OPENCLAW_SESSION_KEY` locally. It authenticates,
requests the same `talk.client.create` configuration as the Mini App, verifies
Gateway-owned control and the local OpenAI offer route, then closes the probe.
`bun run doctor` without `--session` only checks the Talk catalog.

OpenClaw [2026.9.8](https://github.com/openclaw/openclaw/tree/v2026.9.8) includes
the Gateway control and OpenAI WebRTC APIs used here. Run the probe against your
installed Gateway before deploying; no custom OpenClaw source patches are part
of setup. The model needs ChatGPT/Codex authentication, separately from the
Gateway token that authorizes the connector.

The probe does not submit an SDP offer, contact the voice provider, or open a
microphone. Success verifies local session negotiation and cleanup, not provider
credential validity, media connectivity, or audible playback. Test those in a
real Telegram call.

## Deploy from source when no release exists

The root build embeds Vite's frontend into `backend/dist/app` and targets Linux
x86_64. Do not compile `backend/src/main.ts` alone: that skips frontend assets.
Follow the bundled [nibrun skill](../.agents/skills/deploy-to-nibrun/SKILL.md) for
login and environment handling. After filling in your values, the first deploy
has this shape (placeholders are **not** usable credentials):

```sh
nib run ./backend/dist/app --name live-openclaw --port 3000 \
  --env BRIDGE_SECRET=YOUR_GENERATED_SECRET \
  --env TELEGRAM_BOT_ID=YOUR_NUMERIC_BOT_ID \
  --env TELEGRAM_ALLOWED_USER_ID=YOUR_NUMERIC_USER_ID \
  --env OPENCLAW_SESSION_KEY=YOUR_EXISTING_SESSION_KEY \
  --env VOICE_MODEL=gpt-live-1-codex
```

For updates, use `nib run ./backend/dist/app --app YOUR_EXISTING_APP`; existing
environment values are preserved unless explicitly changed. Inspect existing
deployments first. Set the returned HTTPS URL in the connector's `.env`.

## Run the connector persistently

Start interactively with `bun run connector` from the repository root. For Linux,
adapt [the service template](../scripts/live-openclaw-connector.service.example)
to the absolute checkout and Bun paths. Inspect any existing connector service
and preserve its name, settings, and enablement rather than creating a second
one. A new systemd user service can be installed under
`~/.config/systemd/user/live-openclaw-connector.service`, then:

```sh
systemctl --user daemon-reload
systemctl --user enable --now live-openclaw-connector.service
systemctl --user status live-openclaw-connector.service
```

The service user must have access to the same OpenClaw config/provider state;
ensure `openclaw` is in its PATH if credentials use CLI resolution. User services
need an active user manager to run after logout/reboot; inspect the host's
existing setup (including lingering if appropriate). macOS users should use
launchd with the same working directory and environment, not this systemd file.

## Verification and troubleshooting

1. `curl -fsS https://YOUR_RELAY/healthz`: require both `bridgeConnected` and
   `gatewayReady` to be `true`, not just HTTP 200 or `ok`.
2. `/api/config` must show your intended session route and voice model.
3. Set the bot's Web App menu URL through BotFather or Telegram
   [`setChatMenuButton`](https://core.telegram.org/bots/api#setchatmenubutton).
   Inspect the existing menu first; keep bot tokens local. Reopen in Telegram,
   allow microphone access, and test Talk, an audible reply, Mute, and End.
4. Restart the connector service and recheck health to verify recovery.

- **No bridge:** check the connector service, relay URL, and matching secrets.
- **Gateway not ready:** inspect local Gateway availability and authentication.
  Run `bun run doctor --session` and inspect service logs.
- **Unknown Talk method/capability:** this Gateway release is incompatible.
  Update through OpenClaw's supported procedure and rerun the preflight.
- **Provider/authentication error:** validate the selected model's credentials
  in the same agent context.
- **Signature expired/unauthorized:** reopen the app; confirm numeric bot and
  allowed-user IDs. A plain browser visit cannot supply signed Telegram data.
- **Connected but silent:** health and session negotiation do not prove audible
  playback. Check phone permission, WebRTC/UDP connectivity, and playback. Talk
  primes the audio element; if autoplay was blocked, another tap retries it.

## Automatic hangup

This repo does not register a model-selected close action. Saying goodbye does
not guarantee automatic hangup; use **End**. The frontend
retains an experimental receiver for a Gateway `talk.event` with:

```json
{
  "type": "tool.result",
  "sessionId": "ACTIVE_VOICE_SESSION_ID",
  "payload": {
    "toolName": "end_conversation",
    "source": "gpt-live-delegation",
    "status": "close_requested",
    "requestId": "UNIQUE_REQUEST_ID"
  }
}
```

The receiver scopes the event to the active session, deduplicates requests,
waits for playback quiet, and cancels closure on new speech. It handles commands;
it does not register a tool or prove that the model selected the action.
