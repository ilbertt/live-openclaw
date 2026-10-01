import { createPublicKey, type KeyObject, verify } from 'node:crypto';
import { isObject } from '#protocol.ts';

const TELEGRAM_PRODUCTION_KEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
const ED25519_SPKI_PREFIX = '302a300506032b6570032100';

export type TelegramIdentity = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function validateTelegramInitData(
  raw: string,
  options: {
    botId: string;
    allowedUserId: number;
    maxAgeSeconds?: number;
    now?: number;
    publicKey?: KeyObject;
  },
): TelegramIdentity {
  if (!raw || raw.length > 16_384) throw new Error('Missing Telegram authorization');

  const params = new URLSearchParams(raw);
  if (new Set(params.keys()).size !== [...params.keys()].length)
    throw new Error('Duplicate Telegram fields');
  const signature = params.get('signature');
  const authDate = Number(params.get('auth_date'));
  const userRaw = params.get('user');
  if (!signature || !Number.isSafeInteger(authDate) || !userRaw) {
    throw new Error('Incomplete Telegram authorization');
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const dataCheckString = `${options.botId}:WebAppData\n${pairs.join('\n')}`;
  const der = Buffer.from(`${ED25519_SPKI_PREFIX}${TELEGRAM_PRODUCTION_KEY}`, 'hex');
  const key = createPublicKey({ key: der, format: 'der', type: 'spki' });

  if (
    !verify(
      null,
      Buffer.from(dataCheckString),
      options.publicKey ?? key,
      decodeBase64Url(signature),
    )
  ) {
    throw new Error('Invalid Telegram signature');
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 15 * 60;
  if (authDate > now + 30 || now - authDate > maxAgeSeconds) {
    throw new Error('Telegram authorization expired; reopen the Mini App');
  }

  let user: unknown;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error('Invalid Telegram user data');
  }
  if (
    !isObject(user) ||
    typeof user.id !== 'number' ||
    !Number.isSafeInteger(user.id) ||
    user.id !== options.allowedUserId
  ) {
    throw new Error('This Mini App is private');
  }
  for (const field of ['first_name', 'last_name', 'username']) {
    if (user[field] !== undefined && typeof user[field] !== 'string')
      throw new Error('Invalid Telegram user data');
  }
  return {
    id: user.id,
    ...(typeof user.first_name === 'string' ? { first_name: user.first_name } : {}),
    ...(typeof user.last_name === 'string' ? { last_name: user.last_name } : {}),
    ...(typeof user.username === 'string' ? { username: user.username } : {}),
  };
}
