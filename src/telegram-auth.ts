import { createPublicKey, verify } from "node:crypto";

const TELEGRAM_PRODUCTION_KEY =
  "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
const ED25519_SPKI_PREFIX = "302a300506032b6570032100";

export type TelegramIdentity = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function validateTelegramInitData(
  raw: string,
  options: { botId: string; allowedUserId: number; maxAgeSeconds?: number; now?: number },
): TelegramIdentity {
  if (!raw || raw.length > 16_384) throw new Error("Missing Telegram authorization");

  const params = new URLSearchParams(raw);
  const signature = params.get("signature");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!signature || !Number.isSafeInteger(authDate) || !userRaw) {
    throw new Error("Incomplete Telegram authorization");
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const dataCheckString = `${options.botId}:WebAppData\n${pairs.join("\n")}`;
  const der = Buffer.from(`${ED25519_SPKI_PREFIX}${TELEGRAM_PRODUCTION_KEY}`, "hex");
  const key = createPublicKey({ key: der, format: "der", type: "spki" });

  if (!verify(null, Buffer.from(dataCheckString), key, decodeBase64Url(signature))) {
    throw new Error("Invalid Telegram signature");
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 15 * 60;
  if (authDate > now + 30 || now - authDate > maxAgeSeconds) {
    throw new Error("Telegram authorization expired; reopen the Mini App");
  }

  let user: TelegramIdentity;
  try {
    user = JSON.parse(userRaw) as TelegramIdentity;
  } catch {
    throw new Error("Invalid Telegram user data");
  }
  if (!Number.isSafeInteger(user.id) || user.id !== options.allowedUserId) {
    throw new Error("This Mini App is private");
  }
  return user;
}
