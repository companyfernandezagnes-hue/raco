// Compat shim — usa el servicio unificado aiService.
// Antes este archivo llamaba directamente a Gemini; ahora delega en aiService
// que prefiere Claude si hay VITE_ANTHROPIC_API_KEY configurada.
export { getAIAdvice } from './aiService';
