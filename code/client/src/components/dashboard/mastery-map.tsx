import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface ProgressItem { conceptId: string; concept: string; masteryScore: number; status: string; }
interface MasteryMapProps { progress: ProgressItem[]; }

const STATUS_CONFIG = {
  mastered: { color: "from-emerald-500 to-teal-500", text: "text-emerald-300", icon: CheckCircle2, border: "border-emerald-500/40" },
  in_progress: { color: "from-violet-500 to-fuchsia-600", text: "text-violet-300", icon: Clock, border: "border-violet-500/40" },
  not_started: { color: "from-slate-700 to-slate-800", text: "text-slate-600", icon: Circle, border: "border-white/8" },
};

export default function MasteryMap({ progress }: MasteryMapProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
      <h2 className="font-bold text-lg mb-5">Mastery Map</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {progress.map((p: ProgressItem, i: number) => {
          const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_started;
          const Icon = sc.icon;
          return (
            <motion.div
              key={p.conceptId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border ${sc.border} bg-white/3 p-4 relative overflow-hidden`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${sc.color} opacity-5`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 ${sc.text}`} />
                  <span className="text-xs font-bold text-white">{p.masteryScore ?? 0}%</span>
                </div>
                <div className="text-sm font-semibold mb-2 text-slate-200">{p.concept}</div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.masteryScore ?? 0}%` }}
                    transition={{ duration: 0.8, delay: i * 0.06 }}
                    className={`h-full rounded-full bg-gradient-to-r ${sc.color}`}
                  />
                </div>
                <div className={`text-[10px] mt-1.5 capitalize ${sc.text}`}>{p.status?.replace("_", " ")}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}