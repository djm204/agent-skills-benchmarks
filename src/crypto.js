import crypto from 'node:crypto';
import os from 'node:os';
import { getCredential } from './db.js';

const SALT = 'agent-skills-benchmarks-v1';

// Provider name → env var mapping
const PROVIDER_ENV_KEYS = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
};

function deriveKey() {
  const identity = `${os.hostname()}:${os.userInfo().username}`;
  return crypto.scryptSync(identity, SALT, 32);
}

export function encrypt(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_key: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
  };
}

export function decrypt({ encrypted_key, iv, auth_tag }) {
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(auth_tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_key, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Get API key for a provider: checks env var first, then DB.
 * Returns the key string or null.
 */
export function getApiKey(providerName) {
  const envKey = PROVIDER_ENV_KEYS[providerName];
  if (envKey && process.env[envKey]) {
    return process.env[envKey];
  }

  const row = getCredential(providerName);
  if (!row) return null;

  try {
    return decrypt(row);
  } catch {
    return null;
  }
}

/**
 * Check if a provider has a key available (env or DB).
 * Returns 'env' | 'db' | null.
 */
export function getApiKeySource(providerName) {
  const envKey = PROVIDER_ENV_KEYS[providerName];
  if (envKey && process.env[envKey]) return 'env';

  const row = getCredential(providerName);
  if (!row) return null;

  try {
    decrypt(row);
    return 'db';
  } catch {
    return null;
  }
}
