import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as google from './google.js';
import * as mistral from './mistral.js';
import * as groq from './groq.js';

// Priority order for auto-detection
const providers = [anthropic, openai, google, mistral, groq];

const providerMap = Object.fromEntries(providers.map((p) => [p.name, p]));

/**
 * Get a provider by name, or auto-detect from environment variables.
 * Returns the provider function with .modelId and .providerName attached.
 */
export function getProvider(name, options = {}) {
  if (name) {
    const p = providerMap[name];
    if (!p) {
      const available = providers.map((p) => p.name).join(', ');
      throw new Error(`Unknown provider "${name}". Available: ${available}`);
    }
    if (!p.isAvailable()) {
      throw new Error(
        `Provider "${name}" requires ${p.envKey} to be set in environment.`
      );
    }
    return p.createProvider(options);
  }

  // Auto-detect: use first available provider
  for (const p of providers) {
    if (p.isAvailable()) {
      return p.createProvider(options);
    }
  }

  const keys = providers.map((p) => p.envKey).join(', ');
  throw new Error(
    `No LLM provider available. Set one of: ${keys}`
  );
}

/**
 * List all providers with their availability status.
 */
export function listProviders() {
  return providers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    envKey: p.envKey,
    defaultModel: p.defaultModel,
    available: p.isAvailable(),
  }));
}
