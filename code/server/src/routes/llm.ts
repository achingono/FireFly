import { FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

// ─── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMRequestBody {
  prompt: string;
  mode?: string;      // fun | balanced | pro
  userAge?: number;
  context?: string;    // additional context (trace step, code, etc.)
}

interface ChatRequestBody extends LLMRequestBody {
  messages?: ChatMessage[];
}

// ─── LLM Client ─────────────────────────────────────────────────

async function callLLM(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.7 } = options;

  if (env.LLM_PROVIDER === "ollama") {
    // Use Ollama's native API
    const response = await fetch(`${env.LLM_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      message: { content: string };
    };

    return data.message?.content ?? "";
  } else {
    // Use OpenAI-compatible API (LM Studio, etc.)
    const response = await fetch(`${env.LLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? "";
  }
}

function getSystemPrompt(mode?: string, userAge?: number): string {
  const ageStr = userAge ? `The student is ${userAge} years old.` : "";

  const socraticGuidance = `
## Socratic Feedback Method
You have access to exercise hints and solution code. Use them as follows:
- **Hints**: If provided, reference them to guide the student toward the answer. Weave them naturally into your explanation.
- **Solution Code**: Use this internally to understand the correct approach, but NEVER reveal it directly. Instead, ask guiding questions that lead the student to the solution.
- **Approach**: Use open-ended questions like "What would happen if...?", "Have you considered...?", "What part is confusing?". Build understanding step-by-step.`;

  switch (mode) {
    case "fun":
      return `You are FireFly, a friendly and enthusiastic coding tutor for young kids (ages 8-10). ${ageStr} Use simple words, analogies, and encouraging language. Add emojis occasionally. Keep explanations short (2-3 sentences). Never give full solutions — guide with hints.${socraticGuidance}`;
    case "pro":
      return `You are FireFly, a precise and technical coding tutor for advanced students (ages 14+). ${ageStr} Use proper CS terminology. Be concise and direct. Reference memory models, time complexity, and best practices where relevant. No emojis or cutesy language.${socraticGuidance}`;
    default:
      return `You are FireFly, a helpful and clear coding tutor for students (ages 11-13). ${ageStr} Use clear explanations with some technical terms. Be encouraging but not overly enthusiastic. Keep explanations moderate length (3-5 sentences). Never give full solutions — guide with hints.${socraticGuidance}`;
  }
}

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
          "Failed to generate explanation. Is LM Studio running?",
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
          "Failed to generate hint. Is LM Studio running?",
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
          "Failed to generate response. Is LM Studio running?",
          undefined,
          502
        );
      }
    }
  );
};

export default llmRoutes;
