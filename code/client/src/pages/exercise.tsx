import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { client, execution, ai, MasteryUpdateResponse } from "@/api/client";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Play, Lightbulb, Loader2, Eye, ArrowLeft, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/ThemeContext";
import { useAuth } from "@/lib/AuthContext";
import { ResultsPanel, MasteryFeedbackPanel, FILE_EXT_MAP, checkPrerequisites, trySubmitMastery } from "@/components/exercise";
import type { ExerciseResult } from "@/components/exercise";

interface Exercise {
  id: string;
  title: string;
  description?: string | null;
  starterCode: string;
  language: string;
  difficulty: string;
  conceptTags: string[];
  testCases?: string;
  lessons?: Array<{
    lesson: {
      concept: { id: string; name: string };
    };
  }>;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  description: string;
}

interface ConceptSummary {
  name: string;
  prerequisites?: string[];
}

const HINTS_GENERIC = [
  "Think about what each line does step by step.",
  "Try running your code in the visualizer to see what happens.",
  "Check if your variables have the right values at each step."
];

export default function ExercisePage() {
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get("id");
  const conceptId = searchParams.get("conceptId");

  // If we have an exerciseId, show single exercise view
  // If we have a conceptId, show exercises list for that concept
  // Otherwise show all exercises
  if (exerciseId) {
    return <SingleExercise exerciseId={exerciseId} />;
  }
  return <ExerciseList conceptId={conceptId} />;
}

// ─── Exercise List ──────────────────────────────────────────────

function ExerciseList({ conceptId }: Readonly<{ conceptId: string | null }>) {
  const location = useLocation();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [unmetPrereqs, setUnmetPrereqs] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setIsLocked(false);
      setUnmetPrereqs([]);
      try {
        if (!conceptId) {
          const data = await client.entities.exercises.list() as Exercise[];
          setExercises(data);
          return;
        }

        const concept = await client.entities.concepts.get(conceptId) as ConceptSummary | null;
        if (concept) {
          setConceptName(concept.name);
        }

        if (user?.id && concept) {
          const prereqs = (concept.prerequisites ?? []) as string[];
          const { locked, unmetNames } = await checkPrerequisites(prereqs, user.id);
          if (locked) {
            setIsLocked(true);
            setUnmetPrereqs(unmetNames);
            return;
          }
        }

        const data = await client.entities.exercises.list({ conceptId }) as Exercise[];
        setExercises(data);
      } catch (err) {
        console.error("Failed to load exercises:", err);
        setError("Failed to load exercises. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [conceptId, user?.id]);

  const DIFF_COLORS = { beginner: "emerald", intermediate: "amber", advanced: "rose" };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl("Curriculum")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black">
              {conceptName ? `${conceptName} — Exercises` : "All Exercises"}
            </h1>
            {isLocked ? null : (
              <p className="text-slate-500 text-sm mt-1">
                {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-24">
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-violet-400 animate-spin" />
            <p className="text-slate-500">Loading exercises…</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-24 text-slate-500">
            <p>{error}</p>
          </div>
        )}

        {/* Locked concept state */}
        {!loading && !error && isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
              <Lock className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-3">Concept Locked</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              You need to master prerequisite concepts before you can access these exercises.
            </p>
            {unmetPrereqs.length > 0 && (
              <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
                <span className="text-sm text-amber-400">Master:</span>
                {unmetPrereqs.map((name) => (
                  <span key={name} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <Link
              to={createPageUrl("Curriculum")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Curriculum
            </Link>
          </motion.div>
        )}

        {!loading && !error && !isLocked && exercises.length === 0 && (
          <div className="text-center py-24 text-slate-500">
            <p>No exercises found. {conceptId ? "This concept has no exercises yet." : "Seed the database to get started."}</p>
          </div>
        )}

        {!loading && !error && !isLocked && (
          <div className="grid gap-4">
            {exercises.map((ex, i) => {
              const diffColor = DIFF_COLORS[ex.difficulty as keyof typeof DIFF_COLORS] ?? "slate";
              return (
                <motion.div
                  key={ex.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={createPageUrl(`Exercise?id=${ex.id}`)}
                    state={{ from: `${location.pathname}${location.search}` }}
                  >
                    <div className="group rounded-2xl border border-border bg-muted/30 p-5 hover:bg-muted/60 hover:border-border/80 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-base">{ex.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${diffColor}-500/15 text-${diffColor}-400`}>
                          {ex.difficulty}
                        </span>
                      </div>
                      {ex.description && (
                        <p className="text-slate-500 text-sm mb-3">{ex.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono">{ex.language}</span>
                        {ex.conceptTags.length > 0 && (
                          <div className="flex gap-1">
                            {ex.conceptTags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Exercise ────────────────────────────────────────────

function SingleExercise({ exerciseId }: Readonly<{ exerciseId: string }>) {
  const { isPro, mode } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ExerciseResult | null>(null);
  const [shownHint, setShownHint] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [loadingAiHint, setLoadingAiHint] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [masteryFeedback, setMasteryFeedback] = useState<MasteryUpdateResponse | null>(null);
  const [nextExercise, setNextExercise] = useState<Pick<Exercise, "id" | "title"> | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNextExercise(null);
      try {
        const data = await client.entities.exercises.get(exerciseId) as Exercise | null;
        if (data) {
          setExercise(data);
          setCode(data.starterCode || "");
          // Parse test cases (stored as JSON string)
          try {
            const tc = typeof data.testCases === "string" ? JSON.parse(data.testCases) : (data.testCases ?? []);
            setTestCases(Array.isArray(tc) ? tc : []);
          } catch {
            setTestCases([]);
          }

          const currentConceptId = data.lessons?.[0]?.lesson?.concept?.id;
          if (currentConceptId) {
            const conceptExercises = await client.entities.exercises.list({
              conceptId: currentConceptId,
            }) as Exercise[];
            const currentIndex = conceptExercises.findIndex((item) => item.id === data.id);
            const candidate = currentIndex >= 0 ? conceptExercises[currentIndex + 1] : null;
            setNextExercise(candidate ? { id: candidate.id, title: candidate.title } : null);
          }
        }
      } catch (err) {
        console.error("Failed to load exercise:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [exerciseId]);

  const handleSubmit = async () => {
    if (!exercise) return;
    setSubmitting(true);
    setResults(null);
    setMasteryFeedback(null);
    try {
      const result = await execution.run({
        language: exercise.language,
        sourceCode: code,
        exerciseId: exercise.id,
      }) as { jobId: string; status: string; stdout: string | null; stderr: string | null; trace: unknown; testResults?: Array<{ input: string; expectedOutput: string; actualOutput: string; passed: boolean; error?: string }> | null; allTestsPassed?: boolean | null } | null;

      if (!result) return;

      const passed = result.allTestsPassed ?? (result.status === "completed");
      setResults({
        status: passed ? "passed" : "failed",
        stdout: result.stdout,
        stderr: result.stderr,
        jobId: result.jobId,
        testResults: result.testResults,
        allTestsPassed: result.allTestsPassed,
      });

      const conceptId = exercise.lessons?.[0]?.lesson?.concept?.id;
      if (conceptId && user?.id) {
        const masteryResult = await trySubmitMastery(user.id, conceptId, exercise.id, passed);
        if (masteryResult) setMasteryFeedback(masteryResult);
      }
    } catch (err) {
      setResults({
        status: "failed",
        stdout: null,
        stderr: err instanceof Error ? err.message : "Execution failed",
        jobId: null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiHint = async () => {
    if (!exercise) return;
    setLoadingAiHint(true);
    try {
      const res = await ai.hint({
        prompt: `A student is working on this Python exercise: "${exercise.title}". 
Their current code is:
\`\`\`${exercise.language}
${code}
\`\`\`

Give a short, encouraging hint (1-2 sentences) without giving away the solution.`,
        mode,
        context: `Exercise: ${exercise.title}\nDifficulty: ${exercise.difficulty}\nLanguage: ${exercise.language}`,
      });
      setAiHint(res);
    } catch {
      setAiHint("AI hints are not available right now. Try the built-in hints instead!");
    } finally {
      setLoadingAiHint(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Exercise not found.</p>
          <Link to={createPageUrl("Curriculum")} className="text-violet-400 hover:text-violet-300">
            ← Back to Curriculum
          </Link>
        </div>
      </div>
    );
  }

  const fileExtension = FILE_EXT_MAP[exercise.language] ?? exercise.language;
  const locationState = location.state as { from?: string } | null;
  const conceptId = exercise.lessons?.[0]?.lesson?.concept?.id;
  const fallbackBackTo = conceptId
    ? createPageUrl(`Exercise?conceptId=${conceptId}`)
    : createPageUrl("Curriculum");
  const backTo = locationState?.from ?? fallbackBackTo;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 px-5 py-4 border-b border-border bg-muted">
        <Link to={backTo} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold break-words">{exercise.title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="capitalize">{exercise.difficulty}</span>
            <span>•</span>
            <span>{exercise.language}</span>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          <Link to={createPageUrl(`Visualizer?exerciseId=${exercise.id}`)}>
            <button className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:bg-accent transition-colors">
              <Eye className="w-3.5 h-3.5" />
              Visualize
            </button>
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 whitespace-nowrap px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isPro ? "Execute" : "Run"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Left — prompt + results */}
        <div className="lg:w-96 border-r border-border overflow-y-auto p-5 space-y-5">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Challenge</h2>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {exercise.description ?? "Complete the exercise."}
            </p>
          </div>

          {/* Test cases */}
          {testCases.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Test Cases</h2>
              <div className="space-y-2">
                {testCases.map((tc, i) => (
                  <div key={tc.description} className="rounded-xl border border-border bg-muted/30 p-3 text-xs font-mono">
                    <div className="text-slate-400 mb-1">{tc.description}</div>
                    <div>In: <span className="text-sky-400">{tc.input}</span></div>
                    <div>Out: <span className="text-emerald-400">{tc.expectedOutput}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          <div>
            <button
              onClick={() => setShowHints(!showHints)}
              className="flex items-center gap-2 text-amber-400 text-sm font-semibold hover:text-amber-300"
            >
              <Lightbulb className="w-4 h-4" />
              {showHints ? "Hide hints" : "Show hints"}
            </button>
            <AnimatePresence>
              {showHints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2"
                >
                  {HINTS_GENERIC.slice(0, shownHint + 1).map((h, i) => (
                    <div key={h.slice(0, 30)} className="flex gap-2 text-sm text-slate-300 rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
                      <span className="text-amber-400 shrink-0">💡</span>
                      <span>{h}</span>
                    </div>
                  ))}
                  {shownHint < HINTS_GENERIC.length - 1 && (
                    <button
                      onClick={() => setShownHint(p => p + 1)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      + Show next hint
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI hint */}
          <div>
            <button
              onClick={handleAiHint}
              disabled={loadingAiHint}
              className="flex items-center gap-2 text-violet-400 text-sm font-semibold hover:text-violet-300 disabled:opacity-50"
            >
              {loadingAiHint ? <Loader2 className="w-4 h-4 animate-spin" /> : "✨"}
              Ask AI Tutor
            </button>
            {aiHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/25 text-sm text-foreground"
              >
                {aiHint}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right — code editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-muted">
            <span className="text-xs text-slate-500 font-mono">
              main.{fileExtension}
            </span>
          </div>
          <Editor
            height="400px"
            language={exercise.language}
            theme={isPro ? "vs-dark" : "light"}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
            }}
          />

          {/* Results */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border bg-muted overflow-hidden"
              >
                <ResultsPanel results={results} isPro={isPro} nextChallenge={nextExercise} backTo={backTo} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mastery feedback */}
          <AnimatePresence>
            {masteryFeedback && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border overflow-hidden"
              >
                <MasteryFeedbackPanel feedback={masteryFeedback} isPro={isPro} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
