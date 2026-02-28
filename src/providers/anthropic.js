import Anthropic from '@anthropic-ai/sdk';

export const name = 'anthropic';
export const displayName = 'Anthropic Claude';
export const envKey = 'ANTHROPIC_API_KEY';
export const defaultModel = 'claude-sonnet-4-20250514';

export function isAvailable() {
  return Boolean(process.env[envKey]);
}

export function createProvider(options = {}) {
  const model = options.model || defaultModel;
  const client = new Anthropic();

  async function provider(prompt, systemPrompt) {
    const messages = [{ role: 'user', content: prompt }];
    const params = {
      model,
      max_tokens: 4096,
      messages,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    const response = await client.messages.create(params);
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  provider.modelId = model;
  provider.providerName = displayName;
  return provider;
}
