import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CheckCircle2, XCircle, Eye, ArrowRight } from "lucide-react";
import type { ExerciseResult } from "./helpers";

interface NextChallenge {
  id: string;
  title: string;
}

export function ResultsPanel({
  results,
  isPro,
  nextChallenge,
  backTo,
}: {
  results: ExerciseResult;
  isPro: boolean;
  nextChallenge?: NextChallenge | null;
  backTo: string;
}) {
  const passedMessage = isPro ? "Execution complete \u2014 0 errors." : "Code executed successfully! \ud83c\udf89";
  const failedMessage = isPro ? "Execution failed \u2014 see output." : "Execution failed \u2014 check the output below.";
  return (
    <div className="p-4">
      <div className={`flex items-center gap-2 mb-3 font-semibold ${results.status === "passed" ? "text-emerald-400" : "text-rose-400"}`}>
        {results.status === "passed" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        {results.status === "passed" ? passedMessage : failedMessage}
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
      {results.testResults && results.testResults.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs text-slate-500 font-semibold mb-2">Test Results:</h4>
          <div className="space-y-1.5">
            {results.testResults.map((tr, i) => (
              <div
                key={`tr-${i}-${tr.input ?? ""}`}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs font-mono ${
                  tr.passed ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"
                }`}
              >
                {tr.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-slate-400">{tr.input ? `Input: ${tr.input}` : `Test ${i + 1}`}</div>
                  <div className="text-emerald-400/80">
                    Expected: <span className="text-emerald-400">{tr.expectedOutput}</span>
                  </div>
                  <div className={tr.passed ? "text-emerald-400/80" : "text-rose-400/80"}>
                    Actual: <span className={tr.passed ? "text-emerald-400" : "text-rose-400"}>{tr.actualOutput || "(no output)"}</span>
                  </div>
                  {tr.error && <div className="text-rose-400/70 mt-1">{tr.error}</div>}
                </div>
              </div>
            ))}
          </div>
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
      {results.status === "passed" && nextChallenge && (
        <Link
          to={createPageUrl(`Exercise?id=${nextChallenge.id}`)}
          state={{ from: backTo }}
          className="inline-flex items-center gap-2 mt-3 ml-4 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors"
        >
          Next Challenge
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
