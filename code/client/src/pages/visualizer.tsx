import { useState, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { client, execution, ai, progress, MasteryConcept } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import CodePane from "@/components/visualizer/code-pane";
import StackPane from "@/components/visualizer/stack-pane";
import HeapPane from "@/components/visualizer/heap-pane";
import OutputPane from "@/components/visualizer/output-pane";
import StepperControls from "@/components/visualizer/stepper-controls";
import AiExplainPanel from "@/components/visualizer/ai-explain-panel";
import { MOCK_TRACE } from "@/components/visualizer/mock-trace";
import { Play, RotateCcw, ChevronLeft, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

// ─── Types ──────────────────────────────────────────────────────

/** UI-side frame format consumed by stack-pane, heap-pane, output-pane */
interface UIFrame {
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

interface UITrace {
  frames: UIFrame[];
}

/** Backend trace format from execution.ts */
interface BackendFrame {
  step: number;
  line: number;
  event: string;
  funcName: string;
  locals: Record<string, string>;
  stack: Array<{ funcName: string; line: number; locals: Record<string, string> }>;
  returnValue: string | null;
  exception: string | null;
}

interface BackendTrace {
  frames: BackendFrame[];
  stdout: string;
  stderr: string;
  error: { type: string; message: string } | null;
}

// ─── Trace transformer ─────────────────────────────────────────

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
      // Replace Python-style True/False/None for JSON parse
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

function buildUIStack(backendStack: BackendFrame["stack"]): UIFrame["stack"] {
  return backendStack.map((sf, idx) => {
    const locals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sf.locals)) {
      locals[k] = parseRepr(v);
    }
    return { frameId: `f${idx}`, name: sf.funcName, locals };
  });
}

function buildHeapObjects(topLocals: Record<string, string>): UIFrame["heap"] {
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
function transformTrace(backend: BackendTrace, language = "python"): UITrace {
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

// ─── Starter programs ───────────────────────────────────────────

const STARTER_PROGRAMS: Record<string, string> = {
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

function ageProfileToRange(profile: string | undefined): string {
  switch (profile) {
    case "fun": return "8-10";
    case "balanced": return "11-13";
    case "pro": return "14+";
    default: return "11-13";
  }
}

// ─── Resolve-exercise helpers ────────────────────────────────────

function computeConceptSets(concepts: MasteryConcept[]): {
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

async function findLatestExerciseInHistory(userId: string, conceptId: string): Promise<string | null> {
  const conceptProgress = await progress.concept(userId, conceptId);
  const latest = [...(conceptProgress?.history ?? [])]
    .reverse()
    .find((item) => typeof item.exerciseId === "string" && item.exerciseId.length > 0);
  return latest?.exerciseId ?? null;
}

async function tryFindInProgressExercise(userId: string, inProgressConceptIds: string[]): Promise<string | null> {
  for (const conceptId of inProgressConceptIds) {
    const exerciseId = await findLatestExerciseInHistory(userId, conceptId);
    if (!exerciseId) continue;
    const exercise = await client.entities.exercises.get(exerciseId) as Record<string, unknown> | null;
    if (exercise?.id) return exerciseId;
  }
  return null;
}

async function tryFindFirstConceptExercise(conceptIds: string[]): Promise<string | null> {
  for (const conceptId of conceptIds) {
    const exercises = await client.entities.exercises.list({ conceptId }) as Array<Record<string, unknown>>;
    const firstId = exercises[0]?.id as string | undefined;
    if (firstId) return firstId;
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────

export default function Visualizer() {
  const [searchParams] = useSearchParams();
  const exerciseIdParam = searchParams.get("exerciseId");
  const jobIdParam = searchParams.get("jobId");
  const { user } = useAuth();
  const { mode, isFun, isPro } = useTheme();

  const [code, setCode] = useState(STARTER_PROGRAMS.python);
  const [language, setLanguage] = useState("python");
  const [trace, setTrace] = useState<UITrace | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [exerciseTitle, setExerciseTitle] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(exerciseIdParam);

  const ageProfile = ageProfileToRange(user?.ageProfile);

  const currentFrame = trace?.frames?.[currentStep] ?? null;
  const totalFrames = trace?.frames?.length ?? 0;

  // ─── Load exercise or job on mount ──────────────────────────

  useEffect(() => {
    if (exerciseIdParam) {
      loadExercise(exerciseIdParam);
    } else if (jobIdParam) {
      loadJob(jobIdParam);
    } else {
      resolveExerciseForVisualizer();
    }
  }, [exerciseIdParam, jobIdParam, user?.id]);

  async function loadExercise(id: string, options?: { manageLoading?: boolean }) {
    const manageLoading = options?.manageLoading ?? true;
    if (manageLoading) {
      setInitialLoading(true);
    }
    try {
      const ex = await client.entities.exercises.get(id) as Record<string, unknown> | null;
      if (ex) {
        setCode((ex.starterCode as string) || "");
        setLanguage((ex.language as string) || "python");
        setExerciseTitle((ex.title as string) || null);
        setActiveExerciseId(id);
      }
    } catch (err) {
      console.error("Failed to load exercise:", err);
    } finally {
      if (manageLoading) {
        setInitialLoading(false);
      }
    }
  }

  async function resolveExerciseForVisualizer() {
    setInitialLoading(true);
    try {
      let conceptIdsToTry: string[] = [];
      let inProgressConceptIds: string[] = [];

      if (user?.id) {
        const mastery = await progress.masteryMap(user.id);
        const sets = computeConceptSets(mastery?.concepts ?? []);
        conceptIdsToTry = sets.conceptIdsToTry;
        inProgressConceptIds = sets.inProgressConceptIds;

        const inProgressId = await tryFindInProgressExercise(user.id, inProgressConceptIds);
        if (inProgressId) {
          await loadExercise(inProgressId, { manageLoading: false });
          return;
        }
      }

      const conceptExerciseId = await tryFindFirstConceptExercise(conceptIdsToTry);
      if (conceptExerciseId) {
        await loadExercise(conceptExerciseId, { manageLoading: false });
        return;
      }

      const allExercises = await client.entities.exercises.list() as Array<Record<string, unknown>>;
      const firstId = allExercises[0]?.id as string | undefined;
      if (firstId) {
        await loadExercise(firstId, { manageLoading: false });
      }
    } catch (err) {
      console.error("Failed to resolve exercise for visualizer:", err);
    } finally {
      setInitialLoading(false);
    }
  }

  async function loadJob(id: string) {
    setInitialLoading(true);
    try {
      const data = await execution.trace(id) as {
        jobId: string;
        status: string;
        trace: BackendTrace | null;
        stdout: string | null;
        stderr: string | null;
      } | null;

      if (data?.trace) {
        const uiTrace = transformTrace(data.trace, language);
        setTrace(uiTrace);
        setCurrentStep(0);
      }

      // Also load the job to get the source code
      const job = await execution.status(id) as Record<string, unknown> | null;
      if (job) {
        setCode((job.sourceCode as string) || code);
        setLanguage((job.language as string) || "python");
      }
    } catch (err) {
      console.error("Failed to load job trace:", err);
    } finally {
      setInitialLoading(false);
    }
  }

  // ─── Run code ──────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setIsPlaying(false);
    setCurrentStep(0);
    setRunError(null);
    setTrace(null);

    try {
      const result = await execution.run({
        language,
        sourceCode: code,
        exerciseId: activeExerciseId ?? undefined,
      }) as {
        jobId: string;
        status: string;
        stdout: string | null;
        stderr: string | null;
        trace: BackendTrace | null;
      } | null;

      if (result?.trace) {
        const uiTrace = transformTrace(result.trace, language);
        setTrace(uiTrace);
        setCurrentStep(0);
      } else if (result?.status === "completed" && !result.trace) {
        // Unsupported language or tracer didn't produce output — show mock as fallback
        setTrace(MOCK_TRACE as UITrace);
        setRunError("Trace not available for this language. Showing demo trace.");
      } else {
        setRunError(result?.stderr ?? "Execution failed");
      }
    } catch (err) {
      console.error("Execution error:", err);
      setRunError(err instanceof Error ? err.message : "Execution failed");
      // Fall back to mock trace so the UI isn't empty
      setTrace(MOCK_TRACE as UITrace);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, activeExerciseId]);

  // ─── Reset ─────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setTrace(null);
    setRunError(null);
    setIsPlaying(false);
  }, []);

  // ─── AI explain ────────────────────────────────────────────────

  const handleExplain = useCallback(async () => {
    if (!currentFrame) return;
    setShowAi(true);
    setLoadingAi(true);
    setAiExplanation(null);
    try {
      const res = await ai.explain({
        prompt: `Explain what is happening at this code execution step in a friendly, age-appropriate way. Keep it to 2-3 sentences max. Use a simple analogy if helpful.`, 
        mode,
        userAge: user?.age ?? undefined,
        context: `Code line: ${currentFrame.file} line ${currentFrame.line}\nEvent: ${currentFrame.event}\nStack variables: ${JSON.stringify(currentFrame.stack?.[0]?.locals ?? {})}\nStdout so far: "${currentFrame.stdout || "none"}"`,
      });
      setAiExplanation(res);
    } catch {
      setAiExplanation("AI tutor is not available right now. Try stepping through the code to understand it!");
    } finally {
      setLoadingAi(false);
    }
  }, [currentFrame, mode, user?.age]);

  // ─── Language change ───────────────────────────────────────────

  const handleLanguageChange = useCallback(
    (lang: string) => {
      setLanguage(lang);
      if (!activeExerciseId && !jobIdParam) {
        setCode(STARTER_PROGRAMS[lang] ?? "");
      }
      setTrace(null);
      setCurrentStep(0);
      setRunError(null);
    },
    [activeExerciseId, jobIdParam]
  );

  // ─── Loading state ─────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────

  const subtitle = exerciseTitle
    ? `— ${exerciseTitle}`
    : jobIdParam
      ? `— job ${jobIdParam.slice(0, 8)}…`
      : "— sandbox";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted">
        <Link
          to={activeExerciseId ? createPageUrl(`Exercise?id=${activeExerciseId}`) : createPageUrl("Curriculum")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Code Visualizer</span>
          <span className="text-slate-600 text-xs">{subtitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Language (only changeable in sandbox mode) */}
          {!activeExerciseId && !jobIdParam && (
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground focus:outline-none"
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          )}
          {/* Language badge for exercise/job mode */}
          {(activeExerciseId || jobIdParam) && (
            <span className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
              {language}
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {isRunning ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                {isFun ? "Let's Go!" : isPro ? "Execute" : "Run"}
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Run error banner */}
      {runError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs font-mono">
          {runError}
        </div>
      )}

      {/* Main 4-pane grid */}
      <div
        className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_260px_260px_1fr] divide-x divide-border/50 overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <CodePane code={code} setCode={setCode} currentLine={currentFrame?.line} language={language} />
        <StackPane frames={currentFrame?.stack ?? []} />
        <HeapPane objects={currentFrame?.heap ?? []} />
        <OutputPane
          stdout={currentFrame?.stdout ?? ""}
          stderr={currentFrame?.stderr ?? ""}
          step={currentStep}
          total={totalFrames}
        />
      </div>

      {/* Stepper */}
      <StepperControls
        currentStep={currentStep}
        totalFrames={totalFrames}
        onStep={setCurrentStep}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onExplain={handleExplain}
        currentFrame={currentFrame}
      />

      {/* AI explain panel */}
      <AiExplainPanel
        show={showAi}
        onClose={() => setShowAi(false)}
        explanation={aiExplanation}
        loading={loadingAi}
        ageProfile={ageProfile}
        frame={currentFrame}
      />
    </div>
  );
}
