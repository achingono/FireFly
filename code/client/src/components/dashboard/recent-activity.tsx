import { CheckCircle2, XCircle, Play, Zap } from "lucide-react";

const MOCK_ACTIVITY = [
  { type: "passed", title: "Variables Mastery Quiz", xp: 50, time: "2 hours ago", concept: "Variables" },
  { type: "failed", title: "Recursive Fibonacci", xp: 0, time: "Yesterday", concept: "Recursion" },
  { type: "started", title: "Bubble Sort Exercise", xp: 0, time: "Yesterday", concept: "Sorting" },
  { type: "passed", title: "Array Slicing Challenge", xp: 75, time: "2 days ago", concept: "Lists" },
  { type: "xp", title: "7-day streak bonus!", xp: 200, time: "3 days ago", concept: null },
];

const ICONS = {
  passed: { Icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  failed: { Icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  started: { Icon: Play, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  xp: { Icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

export default function RecentActivity() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
      <h2 className="font-bold text-lg mb-4">Recent Activity</h2>
      <div className="space-y-2">
        {MOCK_ACTIVITY.map((act, i) => {
          const cfg = ICONS[act.type as keyof typeof ICONS];
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{act.title}</div>
                <div className="text-xs text-slate-600">{act.concept ? `${act.concept} · ` : ""}{act.time}</div>
              </div>
              {act.xp > 0 && (
                <div className="text-xs font-bold text-amber-400 shrink-0">+{act.xp} XP</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}