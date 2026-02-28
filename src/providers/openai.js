import OpenAI from 'openai';

export const name = 'openai';
export const displayName = 'OpenAI';
export const envKey = 'OPENAI_API_KEY';
export const defaultModel = 'gpt-4o';

export function isAvailable() {
  return Boolean(process.env[envKey]);
}

export function createProvider(options = {}) {
  const model = options.model || defaultModel;
  const client = new OpenAI();

  async function provider(prompt, systemPrompt) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await client.chat.completions.create({
      model,
      max_tokens: 4096,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  provider.modelId = model;
  provider.providerName = displayName;
  return provider;
}
