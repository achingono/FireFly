import { client, progress, MasteryConcept } from "@/api/client";

// ─── Types ──────────────────────────────────────────────────────

/** UI-side frame format consumed by stack-pane, heap-pane, output-pane */
export interface UIFrame {
  step: number;
  timeMs: number;
  file: string;
  line: number;
  event: string;
  stack: Array<{ frameId: string; name: string; locals: Record<string, unknown> }>;
  heap: Array<{ id: string; type: string; repr: string; items?: unknown[]; entries?: Record<string, unknown> }>;
  stdout: string;
  stderr: string;
}

export interface UITrace {
  frames: UIFrame[];
}

/** Backend trace format from execution.ts */
export interface BackendFrame {
  step: number;
  line: number;
  event: string;
  funcName: string;
  locals: Record<string, string>;
  stack: Array<{ funcName: string; line: number; locals: Record<string, string> }>;
  returnValue: string | null;
  exception: string | null;
}

export interface BackendTrace {
  frames: BackendFrame[];
  stdout: string;
  stderr: string;
  error: { type: string; message: string } | null;
}

// ─── Starter programs ───────────────────────────────────────────

export const STARTER_PROGRAMS: Record<string, string> = {
  python: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

arr = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(arr)
print(result)`,
  javascript: `function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j+1]] = [arr[j+1], arr[j]];
      }
    }
  }
  return arr;
}

const arr = [64, 34, 25, 12, 22, 11, 90];
console.log(bubbleSort(arr));`,
};

// ─── Age profile mapping ────────────────────────────────────────

export function ageProfileToRange(profile: string | undefined): string {
  switch (profile) {
    case "fun": return "8-10";
    case "balanced": return "11-13";
    case "pro": return "14+";
    default: return "11-13";
  }
}

// ─── Trace helpers ──────────────────────────────────────────────

/**
 * Parse a Python repr string into a JS value for display.
 * Handles lists, dicts, ints, floats, strings, booleans, None.
 */
function parseRepr(repr: string): unknown {
  if (repr === "None" || repr === "null") return null;
  if (repr === "True") return true;
  if (repr === "False") return false;

  // Integer or float
  if (/^-?\d+(\.\d+)?$/.test(repr)) return Number(repr);

  // String repr: 'hello' or "hello"
  if ((repr.startsWith("'") && repr.endsWith("'")) || (repr.startsWith('"') && repr.endsWith('"'))) {
    return repr.slice(1, -1);
  }

  // List: [1, 2, 3]
  if (repr.startsWith("[") && repr.endsWith("]")) {
    try {
      const jsonified = repr
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null")
        .replace(/'/g, '"');
      return JSON.parse(jsonified);
    } catch {
      return repr;
    }
  }

  // Dict: {'a': 1}
  if (repr.startsWith("{") && repr.endsWith("}")) {
    try {
      const jsonified = repr
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null")
        .replace(/'/g, '"');
      return JSON.parse(jsonified);
    } catch {
      return repr;
    }
  }

  return repr;
}

/** Detect if a repr string represents a heap-allocated type (list, dict, set, object) */
function isHeapType(repr: string): "list" | "dict" | "set" | null {
  if (repr.startsWith("[") && repr.endsWith("]")) return "list";
  if (repr.startsWith("{") && repr.endsWith("}")) {
    // Could be dict or set — dicts have ":" in them
    if (repr.includes(":")) return "dict";
    return "set";
  }
  return null;
}

/** Generate a stable heap object ID from variable name and repr */
function heapId(varName: string, _repr: string): string {
  return `heap_${varName}`;
}

export function buildUIStack(backendStack: BackendFrame["stack"]): UIFrame["stack"] {
  return backendStack.map((sf, idx) => {
    const locals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sf.locals)) {
      locals[k] = parseRepr(v);
    }
    return { frameId: `f${idx}`, name: sf.funcName, locals };
  });
}

export function buildHeapObjects(topLocals: Record<string, string>): UIFrame["heap"] {
  const heap: UIFrame["heap"] = [];
  for (const [k, v] of Object.entries(topLocals)) {
    const heapType = isHeapType(v);
    if (heapType === "list") {
      const parsed = parseRepr(v);
      heap.push({ id: heapId(k, v), type: "list", repr: v, items: Array.isArray(parsed) ? parsed : [] });
    } else if (heapType === "dict") {
      const parsed = parseRepr(v);
      const entries = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
      heap.push({ id: heapId(k, v), type: "dict", repr: v, entries });
    }
  }
  return heap;
}

/**
 * Transform backend trace to UI trace format.
 * - Parses repr strings into real values for locals
 * - Synthesizes heap objects from locals that are lists/dicts
 * - Generates cumulative stdout per frame
 * - Adds file and timeMs defaults
 */
export function transformTrace(backend: BackendTrace, language = "python"): UITrace {
  const frames: UIFrame[] = [];
  const filename = language === "javascript" ? "main.js" : "main.py";

  for (let i = 0; i < backend.frames.length; i++) {
    const bf = backend.frames[i];
    const uiStack = buildUIStack(bf.stack);
    const topLocals = bf.stack.length > 0 ? bf.stack[bf.stack.length - 1].locals : bf.locals;
    const heap = buildHeapObjects(topLocals);

    frames.push({
      step: bf.step,
      timeMs: i * 5,
      file: filename,
      line: bf.line,
      event: bf.event,
      stack: uiStack,
      heap,
      stdout: backend.stdout,
      stderr: backend.stderr,
    });
  }

  return { frames };
}

// ─── Resolve-exercise helpers ────────────────────────────────────

export function computeConceptSets(concepts: MasteryConcept[]): {
  conceptIdsToTry: string[];
  inProgressConceptIds: string[];
} {
  const masteredIds = new Set(concepts.filter((c) => c.mastered).map((c) => c.conceptId));
  const unlocked = concepts
    .filter((c) => !c.mastered && c.prerequisites.every((p) => masteredIds.has(p)))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const seen = new Set<string>();
  const inProgressConceptIds = unlocked
    .filter((c) => c.attempts > 0)
    .sort((a, b) => {
      const aTime = a.lastAttemptAt ? Date.parse(a.lastAttemptAt) : 0;
      const bTime = b.lastAttemptAt ? Date.parse(b.lastAttemptAt) : 0;
      return bTime - aTime;
    })
    .reduce<string[]>((acc, c) => {
      if (!seen.has(c.conceptId)) { seen.add(c.conceptId); acc.push(c.conceptId); }
      return acc;
    }, []);

  const triedSet = new Set(inProgressConceptIds);
  const conceptIdsToTry = [...inProgressConceptIds];
  for (const c of unlocked) {
    if (!triedSet.has(c.conceptId)) { triedSet.add(c.conceptId); conceptIdsToTry.push(c.conceptId); }
  }
  return { conceptIdsToTry, inProgressConceptIds };
}

export async function findLatestExerciseInHistory(userId: string, conceptId: string): Promise<string | null> {
  const conceptProgress = await progress.concept(userId, conceptId);
  const latest = [...(conceptProgress?.history ?? [])]
    .reverse()
    .find((item) => typeof item.exerciseId === "string" && item.exerciseId.length > 0);
  return latest?.exerciseId ?? null;
}

export async function tryFindInProgressExercise(userId: string, inProgressConceptIds: string[]): Promise<string | null> {
  for (const conceptId of inProgressConceptIds) {
    const exerciseId = await findLatestExerciseInHistory(userId, conceptId);
    if (!exerciseId) continue;
    const exercise = await client.entities.exercises.get(exerciseId) as Record<string, unknown> | null;
    if (exercise?.id) return exerciseId;
  }
  return null;
}

export async function tryFindFirstConceptExercise(conceptIds: string[]): Promise<string | null> {
  for (const conceptId of conceptIds) {
    const exercises = await client.entities.exercises.list({ conceptId }) as Array<Record<string, unknown>>;
    const firstId = exercises[0]?.id as string | undefined;
    if (firstId) return firstId;
  }
  return null;
}
