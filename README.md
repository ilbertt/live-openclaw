# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&binary=https%3A%2F%2Fgithub.com%2Filbertt%2Flive-openclaw%2Freleases%2Flatest%2Fdownload%2Flive-openclaw-linux-x64&port=3000&minimal&env=BRIDGE_SECRET&env=TELEGRAM_BOT_ID&env=TELEGRAM_ALLOWED_USER_ID&env=OPENCLAW_SESSION_KEY&env=VOICE_MODEL%3Dgpt-live-1-codex)

A Telegram Mini App for voice calls with your OpenClaw agent. The relay runs on nibrun; a local connector connects it to your Gateway.

## Quickstart

### Requirements

- A Telegram bot and your numeric Telegram user ID. Access is limited to that user.
- An OpenClaw Gateway with Talk RPCs and the `gpt-live-1-codex` adapter.
- A [nibrun](https://nibrun.com) account.
- Bun on the Gateway machine to run the connector. Use the version pinned in [`package.json`](package.json).

### For agents

1. Clone this repo on the Gateway machine. Use the Bun version in `package.json` and run `bun install --frozen-lockfile`.
2. Read [`.env.example`](backend/.env.example). Confirm the bot ID, allowed Telegram user ID, and existing OpenClaw session key. Generate a bridge secret.
3. Follow the [`deploy-to-nibrun`](.agents/skills/deploy-to-nibrun/SKILL.md) skill. Deploy the released `live-openclaw-linux-x64` on port 3000 with the relay variables set on the first deploy. If no release is available, `bun run build` produces `backend/dist/app`.
4. Copy `backend/.env.example` to `backend/.env`. Set `FRIDAY_MINIAPP_URL` to the relay URL and `FRIDAY_MINIAPP_BRIDGE_SECRET` to the same secret.
5. Run `bun run connector` under the Gateway machine's service manager so it survives restarts.
6. Check the relay's `/healthz`: `bridgeConnected` and `gatewayReady` must both be `true`. Set the bot's Mini App menu button to the relay URL, then ask the user to open it and test a voice call.

### For humans

#### 1. Deploy the relay

Click **Deploy on nibrun** to deploy the latest release, including the Mini App. Fill in the relay variables in the deploy form; [`.env.example`](backend/.env.example) describes each one.

#### 2. Start the connector

On the Gateway machine:

```sh
git clone https://github.com/ilbertt/live-openclaw.git
cd live-openclaw
bun install --frozen-lockfile
cp backend/.env.example backend/.env
```

Fill in the connector settings in `backend/.env`. Use the relay's URL and the same shared secret you set on nibrun.

```sh
bun run connector
```

#### 3. Open the Mini App

Set your bot's Mini App menu button to the relay URL. Open it in Telegram, allow microphone access, and tap Talk.

Automatic hangup requires the Gateway to send an `end_conversation` control. The End button works without it.
