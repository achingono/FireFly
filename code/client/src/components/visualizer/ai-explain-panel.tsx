import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";

interface AiExplainPanelProps {
  show: boolean; onClose: () => void; explanation: string | null;
  loading: boolean; ageProfile: string; frame: { line: number; event: string } | null;
}

const AGE_LABELS = { "6-9": "Explorer Mode 🚀", "10-13": "Builder Mode 🏗️", "14-17": "Hacker Mode ⚡" };

export default function AiExplainPanel({ show, onClose, explanation, loading, ageProfile, frame }: AiExplainPanelProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-violet-500/25 shadow-2xl"
        >
          <div className="max-w-4xl mx-auto px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-semibold text-sm">AI Tutor</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">
                  {AGE_LABELS[ageProfile as keyof typeof AGE_LABELS] ?? ageProfile}
                </span>
                {frame && (
                  <span className="text-[11px] text-slate-600 font-mono">· line {frame.line} · {frame.event}</span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 text-slate-400 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                <span className="text-sm">Thinking…</span>
                <div className="flex gap-1 ml-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-200 text-sm leading-relaxed">{explanation}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}