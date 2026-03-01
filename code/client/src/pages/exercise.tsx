import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { client } from "@/api/client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, Play, Lightbulb, CheckCircle2, XCircle, Loader2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MOCK_EXERCISE = {
  id: "ex1",
  title: "Sort an Array with Bubble Sort",
  prompt: `Write a function called \`bubble_sort\` that takes a list of numbers and returns it sorted in ascending order using the bubble sort algorithm.\n\nYour function should:\n1. Compare adjacent elements\n2. Swap them if they're in the wrong order\n3. Repeat until the list is fully sorted`,
  language: "python",
  starterCode: `def bubble_sort(arr):
    # Your code here
    pass

# Test it!
print(bubble_sort([64, 34, 25, 12]))`,
  hints: [
    "Use a nested loop — the outer loop tracks how many passes you've done",
    "Compare arr[j] and arr[j+1] — if arr[j] is bigger, swap them!",
    "In Python, you can swap with: arr[j], arr[j+1] = arr[j+1], arr[j]"
  ],
  testCases: [
    { input: "[64, 34, 25, 12]", expectedOutput: "[12, 25, 34, 64]", description: "Basic unsorted array" },
    { input: "[5, 1, 4, 2, 8]", expectedOutput: "[1, 2, 4, 5, 8]", description: "Five elements" },
    { input: "[1]", expectedOutput: "[1]", description: "Single element" },
  ],
  xpReward: 100,
  difficulty: "intermediate",
};

export default function Exercise() {
  const [exercise] = useState(MOCK_EXERCISE);
  const [code, setCode] = useState(MOCK_EXERCISE.starterCode);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    status: string;
    score: number;
    testResults: { passed: boolean; input: string; expected: string; actual: string; description: string }[];
  } | null>(null);
  const [shownHint, setShownHint] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [loadingAiHint, setLoadingAiHint] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1200));
    // Mock evaluation
    const passed = code.includes("arr[j], arr[j+1]") || code.includes("arr[j+1], arr[j]");
    setResults({
      status: passed ? "passed" : "failed",
      score: passed ? 100 : 40,
      testResults: exercise.testCases.map((tc, i) => ({
        passed: passed && i <= 1,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: passed ? tc.expectedOutput : "[64, 34, 25, 12]",
        description: tc.description,
      })),
    });
    setSubmitting(false);
  };

  const handleAiHint = async () => {
    setLoadingAiHint(true);
    const res = await client.integrations.Core.InvokeLLM({
      prompt: `A student is working on this Python exercise: "${exercise.title}". 
Their current code is:
\`\`\`python
${code}
\`\`\`

Give a short, encouraging hint (1-2 sentences) without giving away the solution. The student is age 10-13.`,
    });
    setAiHint(res);
    setLoadingAiHint(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-white/8 bg-[#0d0d14]">
        <Link to={createPageUrl("Curriculum")} className="text-slate-500 hover:text-white">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold">{exercise.title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="capitalize">{exercise.difficulty}</span>
            <span>•</span>
            <span>{exercise.language}</span>
            <span>•</span>
            <span className="text-amber-400">+{exercise.xpReward} XP</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to={createPageUrl("Visualizer")}>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-slate-300 hover:bg-white/10 transition-colors">
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
            Submit
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-65px)]">
        {/* Left — prompt + results */}
        <div className="lg:w-96 border-r border-white/8 overflow-y-auto p-5 space-y-5">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Challenge</h2>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{exercise.prompt}</p>
          </div>

          {/* Test cases */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Test Cases</h2>
            <div className="space-y-2">
              {exercise.testCases.map((tc, i) => (
                <div key={i} className="rounded-xl border border-white/8 bg-white/3 p-3 text-xs font-mono">
                  <div className="text-slate-400 mb-1">{tc.description}</div>
                  <div>In: <span className="text-sky-400">{tc.input}</span></div>
                  <div>Out: <span className="text-emerald-400">{tc.expectedOutput}</span></div>
                </div>
              ))}
            </div>
          </div>

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
                  {exercise.hints.slice(0, shownHint + 1).map((h, i) => (
                    <div key={i} className="flex gap-2 text-sm text-slate-300 rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
                      <span className="text-amber-400 shrink-0">💡</span>
                      <span>{h}</span>
                    </div>
                  ))}
                  {shownHint < exercise.hints.length - 1 && (
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
          <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-[#0d0d14]">
            <span className="text-xs text-slate-500 font-mono">main.py</span>
          </div>
          <Editor
            height="400px"
            language={exercise.language}
            theme="vs-dark"
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
                className="border-t border-white/8 bg-[#0d0d14] overflow-hidden"
              >
                <div className="p-4">
                  <div className={`flex items-center gap-2 mb-3 font-semibold ${results.status === "passed" ? "text-emerald-400" : "text-rose-400"}`}>
                    {results.status === "passed" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {results.status === "passed" ? `All tests passed! +${exercise.xpReward} XP 🎉` : "Some tests failed — try again!"}
                  </div>
                  <div className="grid gap-2">
                    {results.testResults.map((r, i) => (
                      <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${r.passed ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-rose-500/8 border border-rose-500/20"}`}>
                        {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />}
                        <div>
                          <span className={r.passed ? "text-emerald-300" : "text-rose-300"}>{r.description}</span>
                          {!r.passed && <div className="text-slate-500 mt-0.5">Got: {r.actual}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}