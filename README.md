# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&binary=https%3A%2F%2Fgithub.com%2Filbertt%2Flive-openclaw%2Freleases%2Flatest%2Fdownload%2Flive-openclaw-linux-x64&port=3000&minimal&env=BRIDGE_SECRET&env=TELEGRAM_BOT_ID&env=TELEGRAM_ALLOWED_USER_ID&env=OPENCLAW_SESSION_KEY&env=VOICE_MODEL%3Dgpt-live-1-codex)

A Telegram Mini App for voice calls with your OpenClaw agent. The relay runs on nibrun; a local connector connects it to your Gateway.

## Quickstart

### Requirements

- A Telegram bot and your numeric Telegram user ID. Access is limited to that user.
- An OpenClaw Gateway with Talk RPCs and the `gpt-live-1-codex` adapter.
- A [nibrun](https://nibrun.com) account.
- Bun on the Gateway machine to run the connector. Use the version pinned in [`package.json`](package.json).

### 1. Deploy the relay

Click **Deploy on nibrun** to deploy the latest release, including the Mini App. Fill in the relay variables in the deploy form; [`.env.example`](backend/.env.example) describes each one.

The [`deploy-to-nibrun`](.agents/skills/deploy-to-nibrun/SKILL.md) skill is included for coding agents.

### 2. Start the connector

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

### 3. Open the Mini App

Set your bot's Mini App menu button to the relay URL. Open it in Telegram, allow microphone access, and tap Talk.

Automatic hangup requires the Gateway to send an `end_conversation` control. The End button works without it.
