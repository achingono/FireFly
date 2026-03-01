import { motion } from "framer-motion";

export default function ProgressRing({ progress, masteredCount, total }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 flex flex-col items-center justify-center h-full">
      <h2 className="font-bold text-lg mb-6 self-start">Overall Progress</h2>
      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          <motion.circle
            cx="80" cy="80" r={r}
            fill="none"
            stroke="url(#grad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black">{progress}%</span>
          <span className="text-xs text-slate-500">complete</span>
        </div>
      </div>
      <div className="mt-6 w-full grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2">
          <div className="text-xl font-bold text-emerald-400">{masteredCount}</div>
          <div className="text-xs text-slate-500">mastered</div>
        </div>
        <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 py-2">
          <div className="text-xl font-bold text-violet-400">{total - masteredCount}</div>
          <div className="text-xs text-slate-500">to go</div>
        </div>
      </div>
    </div>
  );
}