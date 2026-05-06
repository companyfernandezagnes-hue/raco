// src/services/aiService.ts
// Servicio unificado de IA: prefiere Anthropic Claude, cae a Google Gemini.
// Detecta proveedor en runtime según las env vars que estén disponibles.
//
// Variables (configurar en .env.local o en GitHub Secrets para CI):
//   VITE_ANTHROPIC_API_KEY   — clave de Anthropic Claude (recomendado)
//   VITE_GEMINI_API_KEY      — clave de Google Gemini (fallback / visión rápida)
//
// IMPORTANTE: Las claves van directamente en el bundle del navegador
// (dangerouslyAllowBrowser). Esto es aceptable para una app INTERNA con login,
// pero NO la expongas en un site público. Para producción de cara al cliente,
// mueve estas llamadas a una Edge Function de Supabase.

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

type Provider = 'claude' | 'gemini';

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
const GEMINI_KEY    = import.meta.env.VITE_GEMINI_API_KEY    as string | undefined;

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!ANTHROPIC_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY, dangerouslyAllowBrowser: true });
  return _anthropic;
}

let _gemini: GoogleGenAI | null = null;
function gemini(): GoogleGenAI | null {
  if (!GEMINI_KEY) return null;
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
  return _gemini;
}

export function preferredProvider(): Provider | null {
  if (ANTHROPIC_KEY) return 'claude';
  if (GEMINI_KEY)    return 'gemini';
  return null;
}

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
  forceProvider?: Provider;
}): Promise<AIResult<string>> {
  const provider = opts.forceProvider ?? preferredProvider();
  if (!provider) {
    return { ok: false, error: { message: 'No hay clave de IA configurada (VITE_ANTHROPIC_API_KEY o VITE_GEMINI_API_KEY).', provider: null } };
  }

  try {
    if (provider === 'claude') {
      const a = anthropic()!;
      const resp = await a.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
        system: opts.system ?? 'Eres un asesor experto en gestión de restaurantes (metodología Mise en Place, ingeniería de menú BCG, control de costes). Respuestas en español, prácticas y accionables.',
        messages: [{ role: 'user', content: opts.prompt }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { ok: true, provider: 'claude', data: text };
    }

    // gemini
    const g = gemini()!;
    const resp = await g.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: (opts.system ? opts.system + '\n\n' : '') + opts.prompt }] },
      ],
    });
    return { ok: true, provider: 'gemini', data: resp.text || '' };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message || 'Error de IA', provider } };
  }
}

// ── Visión (imagen base64) ────────────────────────────────────────────────────
export async function aiVision(opts: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  forceProvider?: Provider;
}): Promise<AIResult<string>> {
  const provider = opts.forceProvider ?? preferredProvider();
  if (!provider) {
    return { ok: false, error: { message: 'No hay clave de IA configurada.', provider: null } };
  }

  try {
    if (provider === 'claude') {
      const a = anthropic()!;
      const resp = await a.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: opts.mimeType as any, data: opts.imageBase64 } },
            { type: 'text', text: opts.prompt },
          ],
        }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { ok: true, provider: 'claude', data: text };
    }

    // gemini
    const g = gemini()!;
    const resp = await g.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: opts.mimeType, data: opts.imageBase64 } },
          { text: opts.prompt },
        ],
      }],
    });
    return { ok: true, provider: 'gemini', data: resp.text || '' };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message || 'Error de IA visión', provider } };
  }
}

// ── JSON estructurado ─────────────────────────────────────────────────────────
export async function aiJSON<T = unknown>(opts: {
  prompt: string;
  system?: string;
  forceProvider?: Provider;
}): Promise<AIResult<T>> {
  const r = await aiText({
    ...opts,
    system: (opts.system || '') + '\n\nResponde SOLO con JSON válido, sin texto adicional, sin markdown, sin ```.',
  });
  if (r.ok === false) return r;
  try {
    // intentar extraer JSON aunque venga en un bloque ```json
    const cleaned = r.data.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const data = JSON.parse(cleaned) as T;
    return { ok: true, provider: r.provider, data };
  } catch (err: any) {
    return { ok: false, error: { message: 'JSON inválido devuelto por la IA: ' + err.message, provider: r.provider } };
  }
}

// ── Compat: getAIAdvice (la usaba AIAdvisor.tsx con Gemini) ───────────────────
export async function getAIAdvice(context: string, userQuery: string): Promise<string> {
  const r = await aiText({
    system: 'Eres un asesor experto en gestión de restaurantes (basado en la metodología Mise en Place, ingeniería de menú BCG y manuales de elBulli Foundation). Da consejos prácticos, análisis de rentabilidad o sugerencias operativas. Respuestas concisas, en español, con bullets cuando sea útil.',
    prompt: `CONTEXTO DEL RESTAURANTE:\n${context}\n\nPREGUNTA DEL USUARIO:\n${userQuery}`,
    maxTokens: 1024,
  });
  if (r.ok === false) return 'Lo siento, no he podido procesar tu consulta. ' + r.error.message;
  return r.data;
}
