import { useState, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { client, execution, ai, progress } from "@/api/client";
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
import {
  UIFrame,
  UITrace,
  BackendFrame,
  BackendTrace,
  STARTER_PROGRAMS,
  ageProfileToRange,
  transformTrace,
  computeConceptSets,
  tryFindInProgressExercise,
  tryFindFirstConceptExercise,
} from "@/lib/visualizer-helpers";

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

  const subtitleSuffix = jobIdParam ? `— job ${jobIdParam.slice(0, 8)}…` : "— sandbox";
  const subtitle = exerciseTitle ? `— ${exerciseTitle}` : subtitleSuffix;

  const runLabelInner = isPro ? "Execute" : "Run";
  const runLabel = isFun ? "Let's Go!" : runLabelInner;

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
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />{" "}
                Running…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                {runLabel}
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
