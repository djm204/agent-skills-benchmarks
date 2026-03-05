import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as google from './google.js';
import * as mistral from './mistral.js';
import * as groq from './groq.js';
import { getApiKey, getApiKeySource } from '../crypto.js';

// Priority order for auto-detection
const providers = [anthropic, openai, google, mistral, groq];

const providerMap = Object.fromEntries(providers.map((p) => [p.name, p]));

/**
 * Ensure a provider's API key is available, checking DB as fallback.
 * Injects into process.env so SDK clients pick it up.
 */
function ensureKey(p) {
  if (p.isAvailable()) return true;
  const key = getApiKey(p.name);
  if (key) {
    process.env[p.envKey] = key;
    return true;
  }
  return false;
}

/**
 * Get a provider by name, or auto-detect from environment variables / DB.
 * Returns the provider function with .modelId and .providerName attached.
 */
export function getProvider(name, options = {}) {
  if (name) {
    const p = providerMap[name];
    if (!p) {
      const available = providers.map((p) => p.name).join(', ');
      throw new Error(`Unknown provider "${name}". Available: ${available}`);
    }
    if (!ensureKey(p)) {
      throw new Error(
        `Provider "${name}" requires ${p.envKey} to be set or stored via the dashboard.`
      );
    }
    return p.createProvider(options);
  }

  // Auto-detect: use first available provider (env or DB)
  for (const p of providers) {
    if (ensureKey(p)) {
      return p.createProvider(options);
    }
  }

  const keys = providers.map((p) => p.envKey).join(', ');
  throw new Error(
    `No LLM provider available. Set one of: ${keys}`
  );
}

/**
 * List all providers with their availability status and key source.
 */
export function listProviders() {
  return providers.map((p) => {
    const source = getApiKeySource(p.name);
    return {
      name: p.name,
      displayName: p.displayName,
      envKey: p.envKey,
      defaultModel: p.defaultModel,
      available: source !== null,
      source: source || 'none',
    };
  });
}
