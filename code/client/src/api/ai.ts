import { request } from "./base";

export interface AiRequestParams {
  prompt: string;
  mode?: string;
  userAge?: number;
  context?: string;
}

export interface AiChatParams extends AiRequestParams {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export const ai = {
  explain: async (params: AiRequestParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/explain", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },

  hint: async (params: AiRequestParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/hint", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },

  chat: async (params: AiChatParams): Promise<string | null> => {
    const envelope = await request<{ response: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return envelope.data?.response ?? null;
  },
};
