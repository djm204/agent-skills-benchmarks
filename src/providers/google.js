import { GoogleGenerativeAI } from '@google/generative-ai';

export const name = 'google';
export const displayName = 'Google Gemini';
export const envKey = 'GOOGLE_API_KEY';
export const defaultModel = 'gemini-2.0-flash';

export function isAvailable() {
  return Boolean(process.env[envKey]);
}

export function createProvider(options = {}) {
  const model = options.model || defaultModel;
  const genAI = new GoogleGenerativeAI(process.env[envKey]);

  async function provider(prompt, systemPrompt) {
    const generativeModel = genAI.getGenerativeModel({
      model,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    });

    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
  }

  provider.modelId = model;
  provider.providerName = displayName;
  return provider;
}
