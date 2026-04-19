import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";
import { env } from "../config/env.js";
import {
  LANGUAGE_IDS,
  submitToJudge0,
  pollJudge0,
  determineJobStatus,
  extractTraceAndStdout,
  runTestsAndFinalizeStatus,
  getWrappedSource,
  logJudge0Result,
  buildJobData,
} from "../lib/judge0.js";
import { executeWithDocker } from "../lib/docker-executor.js";

const executionRoutes: FastifyPluginAsync = async (fastify) => {
  /** POST /api/v1/execution/run — Submit code for execution */
  fastify.post<{
    Body: {
      language: string;
      sourceCode: string;
      stdin?: string;
      exerciseId?: string;
    };
  }>(
    "/api/v1/execution/run",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { language, sourceCode, stdin, exerciseId } = request.body;
      const userId = request.user.sub;

      const MAX_SOURCE_BYTES = 64 * 1024; // 64 KB
      if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) {
        return reply.envelopeError(
          "ValidationError",
          "Source code exceeds the maximum allowed size of 64 KB.",
          undefined,
          400
        );
      }

      const languageId = LANGUAGE_IDS[language];
      if (!languageId) {
        return reply.envelopeError(
          "ValidationError",
          `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_IDS).join(", ")}`,
          undefined,
          400
        );
      }

      let exercise = null;
      if (exerciseId) {
        exercise = await prisma.exercise.findUnique({
          where: { id: exerciseId },
          select: {
            id: true,
            testCases: true,
            language: true,
          },
        });
        if (!exercise) {
          return reply.envelopeError("NotFound", "Exercise not found", undefined, 404);
        }
      }

      const finalSource = getWrappedSource(language, sourceCode);
      const exerciseTestCases = Array.isArray(exercise?.testCases)
        ? (exercise.testCases as Array<{ input: string; expectedOutput: string }>)
        : [];

      const job = await prisma.executionJob.create({
        data: {
          userId,
          exerciseId: exerciseId ?? null,
          language,
          sourceCode,
          stdin: stdin ?? null,
          status: "queued",
        },
      });

      try {
        await prisma.executionJob.update({
          where: { id: job.id },
          data: { status: "running" },
        });

        if (env.EXECUTOR_PROVIDER === "docker") {
          const result = await executeWithDocker({
            language,
            wrappedSource: finalSource,
            sourceCode,
            stdin,
            testCases: exerciseTestCases,
          });

          await prisma.executionJob.update({
            where: { id: job.id },
            data: {
              status: result.status,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              trace: result.trace ? JSON.parse(JSON.stringify(result.trace)) : null,
              durationMs: result.durationMs,
              memoryKb: null,
            },
          });

          return reply.status(201).envelope({
            jobId: job.id,
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
            trace: result.trace,
            durationMs: result.durationMs,
            testResults: result.testResults,
            allTestsPassed: result.testResults
              ? result.testResults.every((testResult) => testResult.passed)
              : null,
          });
        }

        const token = await submitToJudge0({
          source_code: finalSource,
          language_id: languageId,
          stdin: stdin ?? undefined,
          cpu_time_limit: 5,
          memory_limit: 128000,
          wall_time_limit: 10,
        });

        await prisma.executionJob.update({
          where: { id: job.id },
          data: { judge0Token: token },
        });

        const result = await pollJudge0(token);
        logJudge0Result(fastify, language, finalSource, sourceCode, result);

        const { status: resolvedStatus, statusMessage } = determineJobStatus(result);
        const { trace, userStdout, userStderr } = extractTraceAndStdout(language, result);
        const { testResults, finalStatus } = await runTestsAndFinalizeStatus(
          exercise, resolvedStatus, sourceCode, userStdout, language, languageId, fastify
        );

        const jobData = buildJobData(result, finalStatus, userStdout, userStderr, statusMessage, trace);
        await prisma.executionJob.update({ where: { id: job.id }, data: jobData });

        return reply.status(201).envelope({
          jobId: job.id,
          status: finalStatus,
          stdout: userStdout,
          stderr: jobData.stderr,
          trace,
          durationMs: jobData.durationMs,
          testResults,
          allTestsPassed: testResults ? testResults.every(tr => tr.passed) : null,
        });
      } catch (err) {
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            stderr: (err as Error).message,
          },
        });
        return reply.envelopeError(
          "ExecutionError",
          (err as Error).message,
          undefined,
          502
        );
      }
    }
  );

  /** GET /api/v1/execution/jobs/:id — Get execution job status */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/execution/jobs/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const job = await prisma.executionJob.findUnique({
        where: { id: request.params.id },
      });
      if (!job) {
        return reply.envelopeError("NotFound", "Execution job not found", undefined, 404);
      }
      if (job.userId !== request.user.sub && request.user.role !== "admin") {
        return reply.envelopeError("Forbidden", "Not your execution job", undefined, 403);
      }
      return reply.envelope(job);
    }
  );

  /** GET /api/v1/execution/jobs/:id/trace — Get execution trace */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/execution/jobs/:id/trace",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const job = await prisma.executionJob.findUnique({
        where: { id: request.params.id },
        select: { id: true, userId: true, trace: true, stdout: true, stderr: true, status: true },
      });
      if (!job) {
        return reply.envelopeError("NotFound", "Execution job not found", undefined, 404);
      }
      if (job.userId !== request.user.sub && request.user.role !== "admin") {
        return reply.envelopeError("Forbidden", "Not your execution job", undefined, 403);
      }
      return reply.envelope({
        jobId: job.id,
        status: job.status,
        trace: job.trace,
        stdout: job.stdout,
        stderr: job.stderr,
      });
    }
  );
};

export default executionRoutes;
