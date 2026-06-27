import * as crypto from 'crypto';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

// Duplicate of secureStore.ts AES functions for isolated testing
const AES_PREFIX = '$aes$';
const AES_IV_LENGTH = 16;
const AES_KEY_LENGTH = 32;
const AES_ITERATIONS = 100_000;
const AES_DIGEST = 'sha256';

function deriveKey(seed: string): Buffer {
  const salt = crypto.createHash(AES_DIGEST).update(seed).digest();
  return crypto.pbkdf2Sync(seed, salt, AES_ITERATIONS, AES_KEY_LENGTH, AES_DIGEST);
}

function aesEncrypt(value: string, key: Buffer): string {
  const iv = crypto.randomBytes(AES_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${AES_PREFIX}${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

function aesDecrypt(encoded: string, key: Buffer): string {
  const parts = encoded.slice(AES_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid AES encrypted value format');
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf-8');
}

function isAesEncrypted(value: string): boolean {
  return value.startsWith(AES_PREFIX);
}

async function run() {
  console.log('--- SECURESTORE AES FALLBACK TESTS ---');

  const testKey = deriveKey('test-machine-fingerprint');
  const differentKey = deriveKey('different-machine');

  // Basic encrypt/decrypt cycle
  const plaintext = 'sk-test-api-key-12345';
  const encrypted = aesEncrypt(plaintext, testKey);
  assert(encrypted.startsWith(AES_PREFIX), 'encrypted value has AES prefix');
  assert(encrypted.length > AES_PREFIX.length, 'encrypted value has content after prefix');
  const parts = encrypted.slice(AES_PREFIX.length).split(':');
  assert(parts.length === 3, 'encrypted value has 3 colon-separated parts (iv:ciphertext:tag)');
  const decrypted = aesDecrypt(encrypted, testKey);
  assertEqual(decrypted, plaintext, 'decrypted value matches original');

  // isAesEncrypted
  assert(isAesEncrypted(encrypted), 'isAesEncrypted returns true for AES-encrypted value');
  assert(!isAesEncrypted('plaintext-value'), 'isAesEncrypted returns false for plaintext');
  assert(!isAesEncrypted(''), 'isAesEncrypted returns false for empty string');
  assert(!isAesEncrypted('$other$value'), 'isAesEncrypted returns false for other prefix');

  // Different key should fail to decrypt (tamper detection via GCM auth tag)
  try {
    aesDecrypt(encrypted, differentKey);
    assert(false, 'decrypt with wrong key should throw (auth tag mismatch)');
  } catch (e) {
    assert(true, 'decrypt with wrong key throws (auth tag mismatch)');
  }

  // Tampered ciphertext should fail (modify a byte in the ciphertext portion)
  const parts2 = encrypted.split(':');
  const corruptedCiphertext = parts2[1].slice(0, -1) + (parts2[1].slice(-1) === 'A' ? 'B' : 'A');
  const tampered = `${parts2[0]}:${corruptedCiphertext}:${parts2[2]}`;
  try {
    aesDecrypt(tampered, testKey);
    assert(false, 'decrypt of tampered value should throw');
  } catch (e) {
    assert(true, 'decrypt of tampered value throws');
  }

  // Different values produce different ciphertexts (IV randomness)
  const encrypted2 = aesEncrypt(plaintext, testKey);
  assert(encrypted !== encrypted2, 'same plaintext with same key produces different ciphertext (random IV)');

  // Empty string
  const encEmpty = aesEncrypt('', testKey);
  assertEqual(aesDecrypt(encEmpty, testKey), '', 'empty string round-trips correctly');

  // API key-like values
  const apiKeys = [
    'sk-proj-' + 'a'.repeat(40),
    'ghp_' + 'b'.repeat(36),
    'hf_' + 'c'.repeat(32),
    'github_pat_' + 'd'.repeat(40),
    'openai-gpt-4o-api-key-1234567890',
  ];
  for (const key of apiKeys) {
    const enc = aesEncrypt(key, testKey);
    assertEqual(aesDecrypt(enc, testKey), key, `API key style value round-trips: ${key.substring(0, 8)}...`);
  }

  // Long values (simulating large config)
  const longValue = 'x'.repeat(10000);
  const encLong = aesEncrypt(longValue, testKey);
  assertEqual(aesDecrypt(encLong, testKey), longValue, '10KB value round-trips correctly');

  // Multiple sequential encrypt/decrypt with same key (key reuse safety)
  for (let i = 0; i < 50; i++) {
    const v = `test-value-${i}-${'x'.repeat(i * 10)}`;
    const e = aesEncrypt(v, testKey);
    assertEqual(aesDecrypt(e, testKey), v, `sequential round-trip ${i} passes`);
  }

  console.log(`\n--- SECURESTORE AES RESULTS: ${passed} passed, ${failed} failed ---`);
}

run().catch(console.error);
