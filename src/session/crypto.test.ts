import test from 'node:test';
import assert from 'node:assert';
import { encrypt, decrypt } from './crypto.ts';

const VALID_SECRET = 'a'.repeat(64);
const ANOTHER_SECRET = 'b'.repeat(64);

test('crypto - encrypt and decrypt happy path', () => {
  const plaintext = 'hello world';
  const encrypted = encrypt(plaintext, VALID_SECRET);
  const decrypted = decrypt(encrypted, VALID_SECRET);
  assert.strictEqual(decrypted, plaintext);
});

test('crypto - encrypt and decrypt empty string', () => {
  const plaintext = '';
  const encrypted = encrypt(plaintext, VALID_SECRET);
  const decrypted = decrypt(encrypted, VALID_SECRET);
  assert.strictEqual(decrypted, plaintext);
});

test('crypto - fails with wrong secret', () => {
  const plaintext = 'top secret';
  const encrypted = encrypt(plaintext, VALID_SECRET);
  assert.throws(() => {
    decrypt(encrypted, ANOTHER_SECRET);
  }, /Unsupported state or unable to authenticate data/);
});

test('crypto - fails with tampered encrypted data', () => {
  const plaintext = 'top secret';
  const data = encrypt(plaintext, VALID_SECRET);
  data.encrypted[0] ^= 1;
  assert.throws(() => {
    decrypt(data, VALID_SECRET);
  }, /Unsupported state or unable to authenticate data/);
});

test('crypto - fails with tampered iv', () => {
  const plaintext = 'top secret';
  const data = encrypt(plaintext, VALID_SECRET);
  data.iv[0] ^= 1;
  assert.throws(() => {
    decrypt(data, VALID_SECRET);
  }, /Unsupported state or unable to authenticate data/);
});

test('crypto - fails with tampered authTag', () => {
  const plaintext = 'top secret';
  const data = encrypt(plaintext, VALID_SECRET);
  data.authTag[0] ^= 1;
  assert.throws(() => {
    decrypt(data, VALID_SECRET);
  }, /Unsupported state or unable to authenticate data/);
});

test('crypto - fails with invalid secret length', () => {
  const invalidSecret = 'short';
  assert.throws(() => {
    encrypt('test', invalidSecret);
  }, /BOT_ENCRYPTION_SECRET must be a 64-character hex string/);

  const data = encrypt('test', VALID_SECRET);
  assert.throws(() => {
    decrypt(data, invalidSecret);
  }, /BOT_ENCRYPTION_SECRET must be a 64-character hex string/);
});
