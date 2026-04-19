import { request } from "./base";

export const execution = {
  run: async (data: {
    language: string;
    sourceCode: string;
    stdin?: string;
    exerciseId?: string;
  }): Promise<{
    jobId: string;
    status: string;
    stdout: string | null;
    stderr: string | null;
    trace: unknown;
    durationMs: number | null;
    testResults?: Array<{
      input: string;
      expectedOutput: string;
      actualOutput: string;
      passed: boolean;
      error?: string;
    }> | null;
    allTestsPassed?: boolean | null;
  } | null> => {
    const envelope = await request<{
      jobId: string;
      status: string;
      stdout: string | null;
      stderr: string | null;
      trace: unknown;
      durationMs: number | null;
      testResults?: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        passed: boolean;
        error?: string;
      }> | null;
      allTestsPassed?: boolean | null;
    }>("/execution/run", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return envelope.data ?? null;
  },

  status: async (jobId: string): Promise<Record<string, unknown> | null> => {
    const envelope = await request<Record<string, unknown>>(`/execution/jobs/${jobId}`);
    return envelope.data ?? null;
  },

  trace: async (jobId: string): Promise<Record<string, unknown> | null> => {
    const envelope = await request<Record<string, unknown>>(`/execution/jobs/${jobId}/trace`);
    return envelope.data ?? null;
  },
};
