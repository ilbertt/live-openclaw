# Live OpenClaw

[![Deploy on nibrun](https://nibrun.com/button.svg)](https://app.nibrun.com/deploy?name=live-openclaw&port=3000)

A Telegram Mini App for voice calls with your OpenClaw agent.

The relay runs on a public HTTPS host. The connector runs beside your OpenClaw Gateway and connects to the relay. You don't need to expose the Gateway to the internet.

Requires Bun 1.4.2+, a Telegram bot, and an OpenClaw Gateway with Talk RPCs and the `gpt-live-1-codex` adapter. Access is limited to one Telegram user.

## Install

```sh
bun install --frozen-lockfile
cp backend/.env.example backend/.env
```

Edit `backend/.env`. [`.env.example`](backend/.env.example) describes each setting.

Deploy the relay on [nibrun.com](https://nibrun.com). The [`deploy-to-nibrun`](.agents/skills/deploy-to-nibrun/SKILL.md) skill is included.

On the Gateway machine, configure the connector variables and run:

```sh
bun run connector
```

Set your bot's Mini App menu button to the relay URL. Open it in Telegram and tap Talk.

Automatic hangup requires the Gateway to send an `end_conversation` control. The End button works without it.
