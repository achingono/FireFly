import { client, progress, MasteryUpdateResponse, MasteryConcept } from "@/api/client";

export const FILE_EXT_MAP: Record<string, string> = { python: "py", javascript: "js" };

export interface ExerciseResult {
  status: string;
  stdout: string | null;
  stderr: string | null;
  jobId: string | null;
  testResults?: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error?: string;
  }> | null;
  allTestsPassed?: boolean | null;
}

export async function buildMasteryMap(userId: string): Promise<Map<string, MasteryConcept>> {
  const mastery = await progress.masteryMap(userId);
  const map = new Map<string, MasteryConcept>();
  for (const c of mastery?.concepts ?? []) {
    map.set(c.conceptId, c);
  }
  return map;
}

export async function resolveUnmetPrereqNames(
  prereqs: string[],
  masteryById: Map<string, MasteryConcept>
): Promise<string[]> {
  const unmetIds = prereqs.filter((id) => !masteryById.get(id)?.mastered);
  if (unmetIds.length === 0) return [];
  const allConcepts = await client.entities.concepts.list() as Array<{ id: string; name: string }>;
  const conceptsById = new Map(allConcepts.map((c) => [c.id, c]));
  return unmetIds.map((id) => conceptsById.get(id)?.name ?? "Unknown");
}

export async function checkPrerequisites(
  prereqs: string[],
  userId: string
): Promise<{ locked: boolean; unmetNames: string[] }> {
  if (prereqs.length === 0) return { locked: false, unmetNames: [] };
  try {
    const masteryById = await buildMasteryMap(userId);
    const allMet = prereqs.every((id) => masteryById.get(id)?.mastered);
    if (allMet) return { locked: false, unmetNames: [] };
    const unmetNames = await resolveUnmetPrereqNames(prereqs, masteryById);
    return { locked: true, unmetNames };
  } catch {
    return { locked: false, unmetNames: [] };
  }
}

export async function trySubmitMastery(
  userId: string,
  conceptId: string,
  exerciseId: string,
  correct: boolean
): Promise<MasteryUpdateResponse | null> {
  try {
    const result = await progress.submit(userId, { conceptId, correct, exerciseId });
    return result ?? null;
  } catch (err) {
    console.error("Failed to submit mastery update:", err);
    return null;
  }
}
