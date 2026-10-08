# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&binary=https%3A%2F%2Fgithub.com%2Filbertt%2Flive-openclaw%2Freleases%2Flatest%2Fdownload%2Flive-openclaw-linux-x64&port=3000&minimal&env=BRIDGE_SECRET&env=TELEGRAM_BOT_ID&env=TELEGRAM_ALLOWED_USER_ID&env=OPENCLAW_SESSION_KEY&env=VOICE_MODEL%3Dgpt-live-1-codex)

A Telegram Mini App for voice calls with your OpenClaw agent. The relay runs on nibrun; a local connector connects it to your Gateway.

## Quickstart

### Requirements

- A Telegram bot and your numeric Telegram user ID. Access is limited to that user.
- An OpenClaw Gateway with Talk RPCs, the `gpt-live-1-codex` adapter, and
  `gateway-control-v1` WebRTC support. Tested with the published OpenClaw **2026.9.8**
  package; basic calls require **no OpenClaw source patches** on that version.
  The Gateway needs working ChatGPT/Codex authentication for this model, as well
  as its own local Gateway authentication. An ordinary text-model setup alone is
  not sufficient. See [compatibility and troubleshooting](docs/deployment.md).
- A [nibrun](https://nibrun.com) account.
- Bun on the Gateway machine to run the connector. Use the version pinned in [`package.json`](package.json).

### For agents

1. Clone this repo on the Gateway machine. Use the Bun version in `package.json` and run `bun install --frozen-lockfile`.
2. Inspect existing Gateway configuration, connector services, bot menu, and any existing relay before changing them. Preserve their settings; do not create a duplicate deployment or overwrite provider credentials.
3. Create `backend/.env` from [`backend/.env.example`](backend/.env.example) only if it does not already exist (keep it private and out of Git). Confirm the bot ID, allowed Telegram user ID, and **existing** OpenClaw session key; do not copy someone else's route. Generate an independent bridge secret, for example with `openssl rand -hex 32`.
4. Run `bun run doctor --session` with `OPENCLAW_SESSION_KEY` set locally. This checks authenticated Talk RPCs and Gateway-owned WebRTC session negotiation, then closes the probe without opening a microphone. Provider connectivity and audio still need a real call. If it fails, fix Gateway compatibility/authentication **before deploying**. Do not install historical machine-specific patches.
5. Follow the [`deploy-to-nibrun`](.agents/skills/deploy-to-nibrun/SKILL.md) skill. Check whether a release exists before using the deploy button. Deploy `live-openclaw-linux-x64` on port 3000, or run `bun run build` and deploy `backend/dist/app` if no release exists. Set **all relay variables** on the first deploy; a local `.env` is not uploaded automatically. Reuse `--app` for an existing deployment.
6. Set `FRIDAY_MINIAPP_URL` in `backend/.env` to the relay URL and `FRIDAY_MINIAPP_BRIDGE_SECRET` to the same secret. Run the connector under the Gateway machine's service manager; a [systemd user-service template](scripts/live-openclaw-connector.service.example) is included.
7. Check the relay's `/healthz`: `bridgeConnected` and `gatewayReady` must both be `true`. Configure the existing bot's Mini App menu button through Telegram's `setChatMenuButton` API or BotFather. Keep the bot token and Gateway credentials **on the Gateway machine**, never on the public relay. The relay needs only the numeric bot ID.
8. Ask the user to reopen the Mini App and test Talk, audible replies, Mute/Unmute, and End. A green health endpoint is not proof of microphone access or audible playback. Automatic farewell hangup is **not included**; see below.

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

### Automatic hangup and patches

**Saying goodbye does not currently guarantee automatic hangup.** Stock OpenClaw
2026.9.8 does not emit the experimental `end_conversation` control this frontend
can consume. The repo does not register a dedicated close tool with GPT-Live.
Old prompt/JSON adapter patches were not reliable and are not installation
requirements. Use **End** until a real model-selected close action is implemented
and verified in a spoken call. See the [control contract](docs/deployment.md#automatic-hangup).
