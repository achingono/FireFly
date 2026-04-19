import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";

export const BKT = {
  pL0: 0.1,
  pT: 0.2,
  pG: 0.25,
  pS: 0.1,
  MASTERY_THRESHOLD: 0.8,
} as const;

export function bktUpdate(pL: number, correct: boolean): number {
  let pLPosterior: number;

  if (correct) {
    const pCorrect = pL * (1 - BKT.pS) + (1 - pL) * BKT.pG;
    pLPosterior = (pL * (1 - BKT.pS)) / pCorrect;
  } else {
    const pIncorrect = pL * BKT.pS + (1 - pL) * (1 - BKT.pG);
    pLPosterior = (pL * BKT.pS) / pIncorrect;
  }

  const pLNext = pLPosterior + (1 - pLPosterior) * BKT.pT;

  return Math.max(0, Math.min(1, pLNext));
}

export async function upsertMasteryRecord(
  record: { id: string; history: unknown } | null,
  userId: string,
  conceptId: string,
  newScore: number,
  now: Date,
  historyEntry: Prisma.InputJsonValue
) {
  if (record) {
    const existingHistory = Array.isArray(record.history) ? record.history as unknown[] : [];
    return prisma.masteryRecord.update({
      where: { id: record.id },
      data: {
        score: newScore,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        history: [...existingHistory, historyEntry] as Prisma.InputJsonValue[],
      },
    });
  }
  return prisma.masteryRecord.create({
    data: {
      userId,
      conceptId,
      score: newScore,
      attempts: 1,
      lastAttemptAt: now,
      history: [historyEntry],
    },
  });
}

export async function findNewlyUnlockedConcepts(userId: string): Promise<string[]> {
  const allConcepts = await prisma.concept.findMany({
    select: { id: true, name: true, prerequisites: true },
  });
  const allMastery = await prisma.masteryRecord.findMany({
    where: { userId, score: { gte: BKT.MASTERY_THRESHOLD } },
    select: { conceptId: true },
  });
  const masteredSet = new Set(allMastery.map((m) => m.conceptId));
  const unlocked: string[] = [];
  for (const c of allConcepts) {
    const prereqs = Array.isArray(c.prerequisites) ? (c.prerequisites as string[]) : [];
    if (prereqs.length === 0 || masteredSet.has(c.id)) continue;
    if (prereqs.every((p) => masteredSet.has(p))) {
      unlocked.push(c.name);
    }
  }
  return unlocked;
}
