import { motion, AnimatePresence } from "framer-motion";

interface HeapObject { id: string; type: string; repr?: string; items?: unknown[]; entries?: Record<string, unknown>; }
interface HeapPaneProps { objects: HeapObject[]; }

const TYPE_COLORS = {
  list: { border: "border-teal-500/30", bg: "bg-teal-500/8", label: "text-teal-300" },
  dict: { border: "border-sky-500/30", bg: "bg-sky-500/8", label: "text-sky-300" },
  str: { border: "border-emerald-500/30", bg: "bg-emerald-500/8", label: "text-emerald-300" },
  int: { border: "border-amber-500/30", bg: "bg-amber-500/8", label: "text-amber-300" },
  default: { border: "border-white/10", bg: "bg-white/3", label: "text-slate-400" },
};

export default function HeapPane({ objects }: HeapPaneProps) {
  return (
    <div className="flex flex-col overflow-hidden bg-[#0d0d14]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Heap</span>
        <span className="ml-auto text-[10px] text-slate-700">{objects.length} object{objects.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {objects.length === 0 ? (
            <div className="text-center text-slate-700 text-xs mt-8">No heap objects</div>
          ) : (
            objects.map((obj) => {
              const colors = TYPE_COLORS[obj.type as keyof typeof TYPE_COLORS] ?? TYPE_COLORS.default;
              return (
                <motion.div
                  key={obj.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono font-semibold ${colors.label}`}>
                      {obj.type} <span className="opacity-50">#{obj.id}</span>
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">{(obj.repr?.length ?? 0) > 20 ? obj.repr!.slice(0, 20) + "…" : obj.repr}</span>
                  </div>
                  {obj.type === "list" && Array.isArray(obj.items) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {obj.items.map((item: unknown, i: number) => (
                        <motion.div
                          key={i}
                          layout
                          className="min-w-[24px] h-6 px-1.5 rounded-md bg-white/8 border border-white/10 flex items-center justify-center text-[11px] font-mono text-slate-200"
                        >
                          {String(item)}
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {obj.type === "dict" && obj.entries && (
                    <div className="space-y-1 mt-1">
                      {Object.entries(obj.entries).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-[11px] font-mono">
                          <span className="text-sky-400">{k}</span>
                          <span className="text-slate-600">:</span>
                          <span className="text-amber-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(obj.type === "str" || obj.type === "int") && (
                    <div className="text-sm font-mono text-amber-200 mt-1">{obj.repr}</div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}