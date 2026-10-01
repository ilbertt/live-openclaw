import { describe, expect, test } from 'bun:test';
import { validateTelegramInitData } from '../src/lib/telegram-init-data.ts';

import { options, signedData } from './telegram-fixture.ts';

describe('Telegram signature, age, and user validation', () => {
  test('accepts a valid signed allowed user', () =>
    expect(validateTelegramInitData(signedData(), options)).toEqual({
      id: 42,
      first_name: 'Test',
    }));
  test('rejects tampering and a different bot', () => {
    expect(() =>
      validateTelegramInitData(signedData().replace('auth_date=10000', 'auth_date=10001'), options),
    ).toThrow('signature');
    expect(() => validateTelegramInitData(signedData(undefined, 10_000, '456'), options)).toThrow(
      'signature',
    );
  });
  test('rejects expired and future launch data', () => {
    expect(() => validateTelegramInitData(signedData(undefined, 9000), options)).toThrow('expired');
    expect(() => validateTelegramInitData(signedData(undefined, 10_031), options)).toThrow(
      'expired',
    );
  });
  test('rejects another user and malformed signed user data', () => {
    for (const user of [{ id: 99 }, null, [], { id: '42' }, { id: 42, first_name: {} }])
      expect(() => validateTelegramInitData(signedData(user), options)).toThrow();
  });
  test('rejects unsigned, duplicate, and oversized data', () => {
    for (const input of [
      '',
      'user=%7B%22id%22%3A42%7D',
      `${signedData()}&auth_date=10000`,
      'x'.repeat(16_385),
    ])
      expect(() => validateTelegramInitData(input, options)).toThrow();
  });
  test('production key cannot accept the test signer', () =>
    expect(() =>
      validateTelegramInitData(signedData(), { ...options, publicKey: undefined }),
    ).toThrow('signature'));
});
