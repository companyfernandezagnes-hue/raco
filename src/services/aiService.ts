// src/services/aiService.ts
// Compat shim sobre aiProviders.ts.
// Mantiene la API que usaban componentes antiguos (aiText, aiVision, aiJSON,
// getAIAdvice) pero delega en el motor multi-proveedor con fallback automático.
//
// El motor real está en aiProviders.ts y soporta:
//   Claude → Cerebras → DeepSeek → Groq → Mistral → Gemini (fallback chat)
//   Z.AI → Claude → Gemini → Mistral → Groq (fallback visión)

import { askAI, scanBase64, parseJSON, type ChatMessage, type AIProvider } from './aiProviders';

type Provider = AIProvider;

export interface AIError { message: string; provider: Provider | null }
export type AIOk<T>  = { ok: true;  provider: Provider; data: T };
export type AIErr    = { ok: false; error: AIError };
export type AIResult<T = string> = AIOk<T> | AIErr;

// ── Texto ─────────────────────────────────────────────────────────────────────
export async function aiText(opts: {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<AIResult<string>> {
  try {
    const messages: ChatMessage[] = [{ role: 'user', content: opts.prompt }];
    const result = await askAI(
      messages,
      opts.system ?? 'Eres un asesor experto en gestión de restaurantes (Mise en Place, ingeniería de menú BCG, control de costes). Respuestas en español, prácticas y accionables.',
    );
    return { ok: true, provider: result.provider, data: result.text };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message || 'Error de IA', provider: null } };
  }
}

// ── Visión (imagen base64) ────────────────────────────────────────────────────
export async function aiVision(opts: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
}): Promise<AIResult<string>> {
  try {
    const result = await scanBase64(opts.imageBase64, opts.mimeType, opts.prompt);
    // scanBase64 devuelve { raw: jsonObject, provider, model }. Para "texto",
    // serializamos el raw a JSON string si no se puede simplificar.
    const text = typeof (result.raw as any)?.text === 'string'
      ? (result.raw as any).text
      : JSON.stringify(result.raw);
    return { ok: true, provider: result.provider, data: text };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message || 'Error de IA visión', provider: null } };
  }
}

// ── JSON estructurado ─────────────────────────────────────────────────────────
export async function aiJSON<T = unknown>(opts: {
  prompt: string;
  system?: string;
}): Promise<AIResult<T>> {
  const r = await aiText({
    ...opts,
    system: (opts.system || '') + '\n\nResponde SOLO con JSON válido, sin texto adicional, sin markdown, sin ```.',
  });
  if (r.ok === false) return r;
  try {
    const parsed = parseJSON(r.data) as T;
    return { ok: true, provider: r.provider, data: parsed };
  } catch (err: any) {
    return { ok: false, error: { message: 'JSON inválido devuelto por la IA: ' + err.message, provider: r.provider } };
  }
}

// ── Compat: getAIAdvice (la usaba AIAdvisor.tsx) ──────────────────────────────
export async function getAIAdvice(context: string, userQuery: string): Promise<string> {
  const r = await aiText({
    system: 'Eres un asesor experto en gestión de restaurantes (basado en Mise en Place, ingeniería de menú BCG y manuales tipo elBulli Foundation). Da consejos prácticos, análisis de rentabilidad o sugerencias operativas. Respuestas concisas, en español, con bullets cuando sea útil.',
    prompt: `CONTEXTO DEL RESTAURANTE:\n${context}\n\nPREGUNTA DEL USUARIO:\n${userQuery}`,
    maxTokens: 1024,
  });
  if (r.ok === false) return 'Lo siento, no he podido procesar tu consulta. ' + r.error.message;
  return r.data;
}

// ── Reexports útiles ──────────────────────────────────────────────────────────
export { askAI, scanBase64, parseJSON } from './aiProviders';
export { getActiveChatProvider, getActiveVisionProvider, getProvidersStatus } from './aiProviders';
