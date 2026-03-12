import { FastifyPluginAsync } from "fastify";
import {
  ChatMessage,
  LLMRequestBody,
  ChatRequestBody,
  callLLM,
  getSystemPrompt,
} from "../lib/llm-helpers.js";

// ─── Routes ─────────────────────────────────────────────────────

const llmRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/ai/explain — Explain a trace step
  fastify.post<{ Body: LLMRequestBody }>(
    "/api/v1/ai/explain",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { prompt, mode, userAge, context } = request.body;

      if (!prompt) {
        return reply.envelopeError("ValidationError", "prompt is required", undefined, 400);
      }

      try {
        const messages: ChatMessage[] = [
          { role: "system", content: getSystemPrompt(mode, userAge) },
        ];

        if (context) {
          messages.push({
            role: "user",
            content: `Here is the execution context:\n${context}`,
          });
        }

        messages.push({ role: "user", content: prompt });

        const response = await callLLM(messages, { maxTokens: 512 });
        return reply.envelope({ response });
      } catch (err) {
        fastify.log.error(err, "LLM explain failed");
        return reply.envelopeError(
          "LLMError",
          "AI service is currently unavailable. Please try again later.",
          undefined,
          502
        );
      }
    }
  );

  // POST /api/v1/ai/hint — Generate a hint for an exercise
  fastify.post<{ Body: LLMRequestBody }>(
    "/api/v1/ai/hint",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { prompt, mode, userAge, context } = request.body;

      if (!prompt) {
        return reply.envelopeError("ValidationError", "prompt is required", undefined, 400);
      }

      try {
        const systemPrompt = getSystemPrompt(mode, userAge) +
          "\n\nYou are giving a hint for a coding exercise. " +
          "Give a short hint (1-2 sentences) that guides the student without revealing the answer. " +
          "Focus on the concept being tested, not the specific code. " +
          "If exercise hints are provided in the context, use them as inspiration for your guidance but rephrase naturally.";

        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
        ];

        if (context) {
          messages.push({
            role: "user",
            content: `Exercise context:\n${context}`,
          });
        }

        messages.push({ role: "user", content: prompt });

        const response = await callLLM(messages, { maxTokens: 256, temperature: 0.8 });
        return reply.envelope({ response });
      } catch (err) {
        fastify.log.error(err, "LLM hint failed");
        return reply.envelopeError(
          "LLMError",
          "AI service is currently unavailable. Please try again later.",
          undefined,
          502
        );
      }
    }
  );

  // POST /api/v1/ai/chat — General AI tutor chat
  fastify.post<{ Body: ChatRequestBody }>(
    "/api/v1/ai/chat",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { prompt, mode, userAge, context, messages: history } = request.body;

      if (!prompt) {
        return reply.envelopeError("ValidationError", "prompt is required", undefined, 400);
      }

      try {
        const messages: ChatMessage[] = [
          { role: "system", content: getSystemPrompt(mode, userAge) },
        ];

        if (context) {
          messages.push({
            role: "user",
            content: `Here is the relevant context:\n${context}`,
          });
        }

        // Include conversation history if provided (limit to last 10 messages)
        if (history && Array.isArray(history)) {
          const recent = history.slice(-10);
          for (const msg of recent) {
            if (msg.role === "user" || msg.role === "assistant") {
              messages.push({ role: msg.role, content: msg.content });
            }
          }
        }

        messages.push({ role: "user", content: prompt });

        const response = await callLLM(messages, { maxTokens: 1024, temperature: 0.7 });
        return reply.envelope({ response });
      } catch (err) {
        fastify.log.error(err, "LLM chat failed");
        return reply.envelopeError(
          "LLMError",
          "AI service is currently unavailable. Please try again later.",
          undefined,
          502
        );
      }
    }
  );
};

export default llmRoutes;
