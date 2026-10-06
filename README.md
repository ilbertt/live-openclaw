# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&binary=https%3A%2F%2Fgithub.com%2Filbertt%2Flive-openclaw%2Freleases%2Flatest%2Fdownload%2Flive-openclaw-linux-x64&port=3000&minimal&env=BRIDGE_SECRET&env=TELEGRAM_BOT_ID&env=TELEGRAM_ALLOWED_USER_ID&env=OPENCLAW_SESSION_KEY&env=VOICE_MODEL%3Dgpt-live-1-codex)

A Telegram Mini App for voice calls with your OpenClaw agent. The relay runs on nibrun; a local connector connects it to your Gateway.

## Quickstart

### Requirements

- A Telegram bot and your numeric Telegram user ID. Access is limited to that user.
- An OpenClaw Gateway with Talk RPCs, the `gpt-live-1-codex` adapter, and `gateway-control-v1` WebRTC support. The model needs ChatGPT/Codex authentication in addition to local Gateway authentication. See [Gateway compatibility](docs/deployment.md#gateway-compatibility).
- A [nibrun](https://nibrun.com) account.
- Bun on the Gateway machine to run the connector. Use the version pinned in [`package.json`](package.json).

### For agents

1. Clone this repo on the Gateway machine. Use the Bun version in `package.json` and run `bun install --frozen-lockfile`.
2. Read [`.env.example`](backend/.env.example). Confirm the existing bot ID, allowed Telegram user ID, and OpenClaw session key. Create `backend/.env` if needed and generate a bridge secret with `openssl rand -hex 32`.
3. Run `bun run doctor --session` with `OPENCLAW_SESSION_KEY` set locally. This checks Gateway control negotiation and closes the probe; provider connectivity and audio still need a real call.
4. Follow the [`deploy-to-nibrun`](.agents/skills/deploy-to-nibrun/SKILL.md) skill. Deploy the release binary on port 3000 with the relay variables set on the first deploy. If no release exists, `bun run build` produces `backend/dist/app`. For an existing relay, reuse `--app`.
5. Set `FRIDAY_MINIAPP_URL` in `backend/.env` to the relay URL and `FRIDAY_MINIAPP_BRIDGE_SECRET` to the same secret. Keep the bot token and Gateway credentials local; the relay needs only the numeric bot ID.
6. Run the connector under the Gateway machine's service manager so it survives restarts. A [systemd user-service template](scripts/live-openclaw-connector.service.example) is included.
7. Check the relay's `/healthz`: `bridgeConnected` and `gatewayReady` must both be `true`. Set the bot's Mini App menu button to the relay URL.
8. Ask the user to reopen the Mini App and test Talk, audible replies, Mute/Unmute, and End.

### For humans

#### 1. Deploy the relay

If a [release](https://github.com/ilbertt/live-openclaw/releases) exists, click **Deploy on nibrun** to deploy it, including the Mini App. Fill in the relay variables in the deploy form; [`.env.example`](backend/.env.example) describes each one. If there is no release, build and deploy from source using the [deployment guide](docs/deployment.md); the button cannot work without its release asset.

#### 2. Start the connector

On the Gateway machine:

```sh
git clone https://github.com/ilbertt/live-openclaw.git
cd live-openclaw
bun install --frozen-lockfile
cp backend/.env.example backend/.env
```

Fill in the connector settings in `backend/.env`. Use the relay's URL and the same shared secret you set on nibrun. Set `OPENCLAW_SESSION_KEY` as well to run the session preflight:

```sh
chmod 600 backend/.env
bun run doctor --session
```

```sh
bun run connector
```

#### 3. Open the Mini App

Set your bot's Mini App menu button to the relay URL. Open it in Telegram, allow microphone access, and tap Talk.

Talk activates audio in the same tap; Mute/Unmute controls your microphone and End disconnects the call.

### Automatic hangup

Use **End** to hang up. The frontend can consume an experimental `end_conversation` control, but this repo does not register a model-selected close action. Saying goodbye alone does not guarantee hangup. See the [control contract](docs/deployment.md#automatic-hangup).
