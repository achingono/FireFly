export { ApiError, getToken, setToken, request } from "./base";
export type { ApiEnvelope } from "./base";

export { auth } from "./auth";
export type { User } from "./auth";

export { entities } from "./curriculum";

export { execution } from "./execution";

export { progress } from "./mastery";
export type {
  MasteryConcept,
  MasteryMapResponse,
  MasteryUpdateResponse,
  MasteryConceptDetailHistoryItem,
  MasteryConceptDetailResponse,
} from "./mastery";

export { ai } from "./ai";
export type { AiRequestParams, AiChatParams } from "./ai";

import { auth } from "./auth";
import { entities } from "./curriculum";
import { ai } from "./ai";

const integrations = {
  Core: {
    InvokeLLM: async (params: {
      prompt: string;
      response_type?: string;
    }): Promise<string | null> => {
      return ai.explain({ prompt: params.prompt });
    },
  },
};

const appLogs = {
  logUserInApp: async (_pageName: string): Promise<void> => {
    // No-op for now — can be wired to analytics later
  },
};

export const client = {
  auth,
  entities,
  integrations,
  appLogs,
};
