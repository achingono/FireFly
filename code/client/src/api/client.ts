// TODO: Replace with real API client in Wave 2B

interface FireflyClient {
  auth: {
    me: () => Promise<Record<string, unknown> | null>;
    logout: (redirectUrl?: string) => Promise<void>;
    redirectToLogin: (returnUrl?: string) => void;
    login: (email: string, password: string) => Promise<Record<string, unknown> | null>;
    register: (data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
  entities: Record<
    string,
    {
      list: (...args: unknown[]) => Promise<unknown[]>;
      get: (id: string) => Promise<Record<string, unknown> | null>;
    }
  >;
  integrations: {
    Core: {
      InvokeLLM: (params: {
        prompt: string;
        response_type?: string;
      }) => Promise<string | null>;
    };
  };
  appLogs: {
    logUserInApp: (pageName: string) => Promise<void>;
  };
}

const notImplemented =
  (name: string) =>
  (..._args: unknown[]) => {
    console.warn(`[FireflyClient] ${name} not implemented`);
    return Promise.resolve(null);
  };

export const client: FireflyClient = {
  auth: {
    me: notImplemented("auth.me") as FireflyClient["auth"]["me"],
    logout: notImplemented("auth.logout") as unknown as FireflyClient["auth"]["logout"],
    redirectToLogin: () => {
      console.warn("[FireflyClient] redirectToLogin not implemented");
    },
    login: notImplemented("auth.login") as FireflyClient["auth"]["login"],
    register: notImplemented("auth.register") as FireflyClient["auth"]["register"],
  },
  entities: new Proxy({} as FireflyClient["entities"], {
    get: (_target, prop) => ({
      list: notImplemented(`entities.${String(prop)}.list`),
      get: notImplemented(`entities.${String(prop)}.get`),
    }),
  }),
  integrations: {
    Core: {
      InvokeLLM: notImplemented(
        "integrations.Core.InvokeLLM"
      ) as FireflyClient["integrations"]["Core"]["InvokeLLM"],
    },
  },
  appLogs: {
    logUserInApp: notImplemented("appLogs.logUserInApp") as unknown as FireflyClient["appLogs"]["logUserInApp"],
  },
};
