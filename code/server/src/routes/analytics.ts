import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";

async function buildStudentSummary(
  student: { id: string; displayName: string | null; email: string; age: number | null },
  twoDaysAgo: Date
) {
  const studentMastery = await prisma.masteryRecord.findMany({
    where: { userId: student.id },
    select: { score: true, lastAttemptAt: true },
  });

  const avgMastery =
    studentMastery.length > 0
      ? studentMastery.reduce((sum, m) => sum + m.score, 0) / studentMastery.length
      : 0;

  const recentActivity = studentMastery.find((m) => m.lastAttemptAt && m.lastAttemptAt > twoDaysAgo);

  let status: string;
  if (avgMastery >= 0.8) {
    status = "excelling";
  } else if (avgMastery < 0.5 || !recentActivity) {
    status = "needs_help";
  } else {
    status = "on_track";
  }

  return {
    id: student.id,
    fullName: student.displayName,
    email: student.email,
    age: student.age,
    masteryScore: Math.round(avgMastery * 100),
    status,
    recentActivity: recentActivity ? "Active" : "No recent activity",
    streak: 0,
  };
}

function aggregateErrorPatterns(errorJobs: Array<{ stderr: string | null }>): Record<string, number> {
  const keywords = ["nameerror", "typeerror", "syntaxerror", "indexerror", "valueerror", "keyerror", "attributeerror"];
  const patterns: Record<string, number> = {};
  for (const job of errorJobs) {
    const error = job.stderr?.toLowerCase() || "";
    for (const keyword of keywords) {
      if (error.includes(keyword)) {
        patterns[keyword] = (patterns[keyword] || 0) + 1;
      }
    }
  }
  return patterns;
}

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/admin/analytics — Teacher dashboard analytics
  app.get("/api/v1/admin/analytics", { preHandler: [app.requireRole("teacher", "admin")] }, async (request, reply) => {
    const user = request.user;
    // Get all students for this teacher (if teacher)
    const teacherId = user?.role === "teacher" ? user.sub : null;
    const students = await prisma.user.findMany({
      where: { role: "student" },
      select: { id: true, displayName: true, email: true, role: true, age: true },
    });

    // Get all concepts
    const concepts = await prisma.concept.findMany({
      select: { id: true, name: true, difficulty: true },
    });

    // Calculate per-concept mastery for the class
    const conceptMastery: Record<string, { total: number; mastered: number; attempts: number }> = {};
    for (const concept of concepts) {
      conceptMastery[concept.id] = { total: 0, mastered: 0, attempts: 0 };
    }

    // Get mastery records for all students
    const masteryRecords = await prisma.masteryRecord.findMany({
      where: {
        userId: { in: students.map((s) => s.id) },
      },
      select: {
        conceptId: true,
        score: true,
        attempts: true,
        lastAttemptAt: true,
      },
    });

    // Aggregate mastery data
    for (const record of masteryRecords) {
      if (conceptMastery[record.conceptId]) {
        conceptMastery[record.conceptId].total += record.score;
        conceptMastery[record.conceptId].attempts += record.attempts;
        if (record.score >= 0.8) {
          conceptMastery[record.conceptId].mastered += 1;
        }
      }
    }

    // Calculate class averages
    const classMasteryData = concepts.map((concept) => {
      const data = conceptMastery[concept.id];
      const avg = data.total > 0 ? data.total / data.attempts : 0;
      return {
        concept: concept.name,
        conceptId: concept.id,
        difficulty: concept.difficulty,
        classAvg: Math.round(avg * 100),
        masteredCount: data.mastered,
        totalStudents: students.length,
        attempts: data.attempts,
      };
    });

    // Sort by class average (descending)
    classMasteryData.sort((a, b) => b.classAvg - a.classAvg);

    // Get students needing attention (mastery < 50% or no recent activity)
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const studentsNeedingAttention = await Promise.all(
      students.map((student) => buildStudentSummary(student, twoDaysAgo))
    );

    // Sort by status (needs_help first, then on_track, then excelling)
    const statusOrder = { needs_help: 0, on_track: 1, excelling: 2 };
    studentsNeedingAttention.sort((a, b) => statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]);

    // Get common errors (from execution jobs with errors)
    const errorJobs = await prisma.executionJob.findMany({
      where: {
        userId: { in: students.map((s) => s.id) },
        status: "failed",
        stderr: { not: null },
      },
      select: {
        userId: true,
        stderr: true,
        createdAt: true,
      },
      take: 100,
    });

    const errorPatterns = aggregateErrorPatterns(errorJobs);

    // Get top 5 error patterns
    const topErrors = Object.entries(errorPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    // Get time-to-mastery for concepts (average days from first attempt to mastery >= 0.8)
    const timeToMastery: Record<string, { days: number; attempts: number }> = {};
    for (const concept of concepts) {
      const conceptMasteryRecords = masteryRecords.filter((r) => r.conceptId === concept.id && r.score >= 0.8);
      if (conceptMasteryRecords.length > 0) {
        timeToMastery[concept.id] = {
          days: 0,
          attempts: conceptMasteryRecords.length,
        };
      }
    }

    const timeToMasteryData = concepts
      .map((concept) => ({
        concept: concept.name,
        conceptId: concept.id,
        difficulty: concept.difficulty,
        avgDays: timeToMastery[concept.id]?.days || 0,
        attempts: timeToMastery[concept.id]?.attempts || 0,
      }))
      .filter((d) => d.attempts > 0)
      .sort((a, b) => b.avgDays - a.avgDays);

    return reply.envelope({
      students: studentsNeedingAttention,
      classMastery: classMasteryData,
      topErrors,
      timeToMastery: timeToMasteryData,
      totalStudents: students.length,
      teacherId,
    });
  });
};

export default analyticsRoutes;