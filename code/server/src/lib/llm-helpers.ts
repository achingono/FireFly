import { env } from "../config/env.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequestBody {
  prompt: string;
  mode?: string;
  userAge?: number;
  context?: string;
}

export interface ChatRequestBody extends LLMRequestBody {
  messages?: ChatMessage[];
}

export async function callLLM(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.7 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

  try {
  if (env.LLM_PROVIDER === "ollama") {
    const response = await fetch(`${env.LLM_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
    const response = await fetch(`${env.LLM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

const SOCRATIC_GUIDANCE = `
## Socratic Feedback Method
You have access to exercise hints and solution code. Use them as follows:
- **Hints**: If provided, reference them to guide the student toward the answer. Weave them naturally into your explanation.
- **Solution Code**: Use this internally to understand the correct approach, but NEVER reveal it directly. Instead, ask guiding questions that lead the student to the solution.
- **Approach**: Use open-ended questions like "What would happen if...?", "Have you considered...?", "What part is confusing?". Build understanding step-by-step.`;

export function getSystemPrompt(mode?: string, userAge?: number): string {
  const ageStr = userAge ? `The student is ${userAge} years old.` : "";

  switch (mode) {
    case "fun":
      return `You are FireFly, a friendly and enthusiastic coding tutor for young kids (ages 8-10). ${ageStr} Use simple words, analogies, and encouraging language. Add emojis occasionally. Keep explanations short (2-3 sentences). Never give full solutions — guide with hints.${SOCRATIC_GUIDANCE}`;
    case "pro":
      return `You are FireFly, a precise and technical coding tutor for advanced students (ages 14+). ${ageStr} Use proper CS terminology. Be concise and direct. Reference memory models, time complexity, and best practices where relevant. No emojis or cutesy language.${SOCRATIC_GUIDANCE}`;
    default:
      return `You are FireFly, a helpful and clear coding tutor for students (ages 11-13). ${ageStr} Use clear explanations with some technical terms. Be encouraging but not overly enthusiastic. Keep explanations moderate length (3-5 sentences). Never give full solutions — guide with hints.${SOCRATIC_GUIDANCE}`;
  }
}
