import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { client, execution } from "@/api/client";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Play, Lightbulb, CheckCircle2, XCircle, Loader2, Eye, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/ThemeContext";

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

function ExerciseList({ conceptId }: { conceptId: string | null }) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // If conceptId, fetch concept detail for name and load exercises
        if (conceptId) {
          const concept = await client.entities.concepts.get(conceptId) as Record<string, unknown> | null;
          if (concept) {
            setConceptName(concept.name as string);
          }
          const data = await client.entities.exercises.list({ conceptId }) as Exercise[];
          setExercises(data);
        } else {
          const data = await client.entities.exercises.list() as Exercise[];
          setExercises(data);
        }
      } catch (err) {
        console.error("Failed to load exercises:", err);
        setError("Failed to load exercises. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [conceptId]);

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
            <p className="text-slate-500 text-sm mt-1">
              {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} available
            </p>
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

        {!loading && !error && exercises.length === 0 && (
          <div className="text-center py-24 text-slate-500">
            <p>No exercises found. {conceptId ? "This concept has no exercises yet." : "Seed the database to get started."}</p>
          </div>
        )}

        {!loading && !error && (
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
                  <Link to={createPageUrl(`Exercise?id=${ex.id}`)}>
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

function SingleExercise({ exerciseId }: { exerciseId: string }) {
  const { isPro } = useTheme();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    status: string;
    stdout: string | null;
    stderr: string | null;
    jobId: string | null;
  } | null>(null);
  const [shownHint, setShownHint] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [loadingAiHint, setLoadingAiHint] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
    try {
      const result = await execution.run({
        language: exercise.language,
        sourceCode: code,
        exerciseId: exercise.id,
      }) as { jobId: string; status: string; stdout: string | null; stderr: string | null; trace: unknown } | null;

      if (result) {
        setResults({
          status: result.status === "completed" ? "passed" : "failed",
          stdout: result.stdout,
          stderr: result.stderr,
          jobId: result.jobId,
        });
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
      const res = await client.integrations.Core.InvokeLLM({
        prompt: `A student is working on this Python exercise: "${exercise.title}". 
Their current code is:
\`\`\`${exercise.language}
${code}
\`\`\`

Give a short, encouraging hint (1-2 sentences) without giving away the solution. The student is age 10-13.`,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border bg-muted">
        <Link to={createPageUrl("Curriculum")} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold">{exercise.title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="capitalize">{exercise.difficulty}</span>
            <span>•</span>
            <span>{exercise.language}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to={createPageUrl(`Visualizer?exerciseId=${exercise.id}`)}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:bg-accent transition-colors">
              <Eye className="w-3.5 h-3.5" />
              Visualize
            </button>
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isPro ? "Execute" : "Run"}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-65px)]">
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
                  <div key={i} className="rounded-xl border border-border bg-muted/30 p-3 text-xs font-mono">
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
                    <div key={i} className="flex gap-2 text-sm text-slate-300 rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
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
                className="mt-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/25 text-sm text-slate-300"
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
              main.{exercise.language === "python" ? "py" : exercise.language === "javascript" ? "js" : exercise.language}
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
                <div className="p-4">
                  <div className={`flex items-center gap-2 mb-3 font-semibold ${results.status === "passed" ? "text-emerald-400" : "text-rose-400"}`}>
                    {results.status === "passed" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {results.status === "passed"
                      ? (isPro ? "Execution complete \u2014 0 errors." : "Code executed successfully! \ud83c\udf89")
                      : (isPro ? "Execution failed \u2014 see output." : "Execution failed \u2014 check the output below.")}
                  </div>
                  {results.stdout && (
                    <div className="mt-2">
                      <h4 className="text-xs text-slate-500 font-semibold mb-1">stdout:</h4>
                      <pre className="text-xs font-mono text-green-400/90 bg-black/30 rounded-lg p-3 whitespace-pre-wrap">{results.stdout}</pre>
                    </div>
                  )}
                  {results.stderr && (
                    <div className="mt-2">
                      <h4 className="text-xs text-slate-500 font-semibold mb-1">stderr:</h4>
                      <pre className="text-xs font-mono text-rose-400/90 bg-black/30 rounded-lg p-3 whitespace-pre-wrap">{results.stderr}</pre>
                    </div>
                  )}
                  {results.jobId && (
                    <Link
                      to={createPageUrl(`Visualizer?jobId=${results.jobId}`)}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400 hover:text-violet-300"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View execution trace in Visualizer
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
