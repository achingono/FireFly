import { motion, AnimatePresence } from "framer-motion";

interface StackFrame { frameId: string; name: string; locals?: Record<string, unknown>; }
interface StackPaneProps { frames: StackFrame[]; }

export default function StackPane({ frames }: StackPaneProps) {
  return (
    <div className="flex flex-col overflow-hidden bg-[#0d0d14]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Call Stack</span>
        <span className="ml-auto text-[10px] text-slate-700">{frames.length} frame{frames.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {frames.length === 0 ? (
            <div className="text-center text-slate-700 text-xs mt-8">No active frames</div>
          ) : (
            [...frames].reverse().map((frame, i) => (
              <motion.div
                key={frame.frameId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl border p-3 ${i === 0 ? "border-violet-500/40 bg-violet-500/10" : "border-white/8 bg-white/3 opacity-50"}`}
              >
                <div className={`text-xs font-semibold font-mono mb-2 ${i === 0 ? "text-violet-300" : "text-slate-500"}`}>
                  {i === 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 mr-1.5 mb-0.5" />}
                  {frame.name}
                  {i === 0 && <span className="ml-1.5 text-[10px] font-normal text-violet-500">← active</span>}
                </div>
                <div className="space-y-1">
                  {Object.entries(frame.locals ?? {}).map(([k, v]) => (
                    <motion.div
                      key={k}
                      layout
                      className="flex items-center justify-between text-[11px] font-mono gap-2"
                    >
                      <span className="text-sky-400 shrink-0">{k}</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-amber-300 truncate text-right">{formatVal(v)}</span>
                    </motion.div>
                  ))}
                  {Object.keys(frame.locals ?? {}).length === 0 && (
                    <span className="text-slate-700 text-[10px]">empty</span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatVal(v: unknown) {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  if (v === null) return "None";
  if (v === undefined) return "—";
  return String(v);
}