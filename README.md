# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&port=3000)

A Telegram Mini App for voice calls with your OpenClaw agent. The relay runs on nibrun; a local connector connects it to your Gateway.

## Quickstart

### Requirements

- A Telegram bot and your numeric Telegram user ID. Access is limited to that user.
- An OpenClaw Gateway with Talk RPCs and the `gpt-live-1-codex` adapter.
- A [nibrun](https://nibrun.com) account.
- Bun 1.4.2+ on the Gateway machine to run the connector.

### 1. Deploy the relay

Download `live-openclaw-linux-x64` from [GitHub Releases](https://github.com/ilbertt/live-openclaw/releases) and deploy it on nibrun. It includes the Mini App. Set the relay variables from [`.env.example`](backend/.env.example) in your nibrun app's environment settings.

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
