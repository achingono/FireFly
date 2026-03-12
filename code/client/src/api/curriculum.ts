import { request } from "./base";

interface EntityMethods {
  list: (...args: unknown[]) => Promise<unknown[]>;
  get: (id: string) => Promise<Record<string, unknown> | null>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
}

function createEntityMethods(resource: string): EntityMethods {
  return {
    list: async (...args: unknown[]) => {
      const params = (args[0] as Record<string, string>) ?? {};
      const qs = new URLSearchParams(params).toString();
      const suffix = qs ? `?${qs}` : "";
      const path = `/${resource}${suffix}`;
      const envelope = await request<unknown[]>(path);
      return envelope.data ?? [];
    },
    get: async (id: string) => {
      const envelope = await request<Record<string, unknown>>(`/${resource}/${id}`);
      return envelope.data ?? null;
    },
    create: async (data: Record<string, unknown>) => {
      const envelope = await request<Record<string, unknown>>(`/${resource}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return envelope.data ?? null;
    },
  };
}

export const entities = new Proxy({} as Record<string, EntityMethods>, {
  get: (_target, prop) => createEntityMethods(String(prop)),
});
