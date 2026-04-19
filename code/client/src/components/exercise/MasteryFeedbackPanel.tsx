import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { MasteryUpdateResponse } from "@/api/client";

interface MasteryFeedbackPanelProps {
  feedback: MasteryUpdateResponse;
  isPro: boolean;
}

export function MasteryFeedbackPanel({ feedback, isPro }: Readonly<MasteryFeedbackPanelProps>) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className={`text-sm font-semibold ${feedback.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          Mastery: {Math.round(feedback.newScore * 100)}%
          <span className="ml-2 text-xs">
            ({feedback.delta >= 0 ? "+" : ""}{Math.round(feedback.delta * 100)}%)
          </span>
        </div>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-violet-500 rounded-full"
            initial={{ width: `${Math.round(feedback.previousScore * 100)}%` }}
            animate={{ width: `${Math.round(feedback.newScore * 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
      {feedback.justMastered && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-emerald-400">
            {isPro ? "Concept mastered." : "You mastered this concept! \uD83C\uDF1F"}
          </span>
        </motion.div>
      )}
      {feedback.newlyUnlocked.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-violet-400">
          <span>{isPro ? "Unlocked:" : "\uD83D\uDD13 New concepts unlocked:"}</span>
          {feedback.newlyUnlocked.map((name) => (
            <span key={name} className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-medium">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
