import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getAIAdvice(context: string, userQuery: string) {
    try {
          const response = await ai.models.generateContent({
                  model: "gemini-2.5-pro-preview-03-25",
                  contents: `Eres un asesor experto en gestión de restaurantes (basado en la metodología Mise en Place y análisis de ventas).

                  CONTEXTO DEL RESTAURANTE:
                  ${context}

                  PREGUNTA DEL USUARIO:
                           ${userQuery}

                           Proporciona consejos prácticos, análisis de rentabilidad o sugerencias operativas basadas en los manuales de gestión.`,
                  config: {
                            thinkingConfig: {
                                        thinkingLevel: ThinkingLevel.HIGH
                            }
                  }
          });

      return response.text;
    } catch (error) {
          console.error("Error calling Gemini:", error);
          return "Lo siento, no he podido procesar tu consulta en este momento. Por favor, inténtalo de nuevo más tarde.";
    }
}
