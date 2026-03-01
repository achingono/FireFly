import { Terminal, AlertCircle } from "lucide-react";

export default function OutputPane({ stdout, stderr, step, total }) {
  const lines = stdout ? stdout.split("\n").filter(Boolean) : [];
  const errLines = stderr ? stderr.split("\n").filter(Boolean) : [];

  return (
    <div className="flex flex-col overflow-hidden bg-[#0d0d14]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <Terminal className="w-3 h-3 text-slate-500" />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Output</span>
        <span className="ml-auto text-[10px] text-slate-600">Step {step + 1}/{total}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {lines.length === 0 && errLines.length === 0 ? (
          <span className="text-slate-700">No output yet…</span>
        ) : (
          <>
            {lines.map((line, i) => (
              <div key={i} className="text-green-400/90 leading-5">{line}</div>
            ))}
            {errLines.map((line, i) => (
              <div key={i} className="flex items-start gap-1.5 text-rose-400 leading-5">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                {line}
              </div>
            ))}
          </>
        )}
      </div>
      {/* Step event badge */}
      <div className="px-3 pb-3">
        <div className="rounded-lg bg-white/3 border border-white/8 px-3 py-2 text-[11px] text-slate-500 font-mono">
          step <span className="text-violet-400">{step + 1}</span> of <span className="text-slate-400">{total}</span>
        </div>
      </div>
    </div>
  );
}