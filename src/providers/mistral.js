import { Mistral } from '@mistralai/mistralai';

export const name = 'mistral';
export const displayName = 'Mistral AI';
export const envKey = 'MISTRAL_API_KEY';
export const defaultModel = 'mistral-large-latest';

export function isAvailable() {
  return Boolean(process.env[envKey]);
}

export function createProvider(options = {}) {
  const model = options.model || defaultModel;
  const client = new Mistral({ apiKey: process.env[envKey] });

  async function provider(prompt, systemPrompt) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await client.chat.complete({
      model,
      maxTokens: 4096,
      messages,
    });

    return response.choices?.[0]?.message?.content || '';
  }

  provider.modelId = model;
  provider.providerName = displayName;
  return provider;
}
