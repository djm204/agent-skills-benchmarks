import Groq from 'groq-sdk';

export const name = 'groq';
export const displayName = 'Groq';
export const envKey = 'GROQ_API_KEY';
export const defaultModel = 'llama-3.3-70b-versatile';

export function isAvailable() {
  return Boolean(process.env[envKey]);
}

export function createProvider(options = {}) {
  const model = options.model || defaultModel;
  const client = new Groq();

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
