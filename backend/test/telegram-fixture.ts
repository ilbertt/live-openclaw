import { generateKeyPairSync, sign } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
export const options = { botId: '123', allowedUserId: 42, now: 10_000, publicKey };
export function signedData(
  user: unknown = { id: 42, first_name: 'Test' },
  date = 10_000,
  botId = '123',
): string {
  const fields = { auth_date: String(date), user: JSON.stringify(user) };
  const body = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const signature = sign(null, Buffer.from(`${botId}:WebAppData\n${body}`), privateKey).toString(
    'base64url',
  );
  return new URLSearchParams({ ...fields, signature }).toString();
}

export const testPublicKey = publicKey;
