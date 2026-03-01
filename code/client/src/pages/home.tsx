import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Code2, Zap, Star, Users, BookOpen, Play } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Code2, title: "Live Code Visualizer", desc: "Watch every variable, stack frame, and heap object update in real-time as your code runs.", color: "from-violet-500 to-purple-600" },
  { icon: Zap, title: "AI Tutor", desc: "Get age-appropriate explanations for any code step — from dragons to binary trees.", color: "from-amber-400 to-orange-500" },
  { icon: Star, title: "Mastery Tracking", desc: "Level up through concepts with an XP system and visual mastery map.", color: "from-emerald-400 to-teal-500" },
  { icon: Users, title: "Teacher Dashboard", desc: "Monitor class progress, spot struggling students, and assign exercises.", color: "from-sky-400 to-blue-600" },
];

const AGE_THEMES = [
  { range: "Ages 6–9", label: "Explorer", emoji: "🚀", desc: "Block-based thinking, stories, and drag-friendly concepts", color: "bg-gradient-to-br from-pink-400 to-rose-500" },
  { range: "Ages 10–13", label: "Builder", emoji: "🏗️", desc: "Python & JavaScript basics, loops, functions, and objects", color: "bg-gradient-to-br from-violet-500 to-purple-700" },
  { range: "Ages 14–17", label: "Hacker", emoji: "⚡", desc: "Algorithms, data structures, recursion, and real projects", color: "bg-gradient-to-br from-slate-700 to-slate-900" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Hero */}
      <section className="relative pt-20 pb-32 px-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,255,0.3),transparent)]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered • Visual • Adaptive
          </div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-none">
            Learn to code<br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              by seeing it live
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            FireFly visualizes every step of your code — stack frames, heap objects, variable changes — with AI explanations tailored to your age.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={createPageUrl("Visualizer")}>
              <button className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-lg hover:opacity-90 transition-all shadow-lg shadow-violet-500/25">
                <Play className="w-5 h-5" />
                Try the Visualizer
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link to={createPageUrl("Curriculum")}>
              <button className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-white/10 bg-white/5 font-semibold text-lg hover:bg-white/10 transition-all">
                <BookOpen className="w-5 h-5" />
                Explore Curriculum
              </button>
            </Link>
          </div>
        </motion.div>

        {/* Fake screen preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="relative max-w-5xl mx-auto mt-20"
        >
            <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-violet-900/20 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-slate-500 text-xs ml-3 font-mono">firefly/visualizer</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5 min-h-[200px]">
              {["CODE", "STACK", "HEAP", "OUTPUT"].map((pane) => (
                <div key={pane} className="p-4">
                  <div className="text-[10px] font-mono text-violet-400/60 mb-3 tracking-widest">{pane}</div>
                  {pane === "CODE" && (
                    <div className="font-mono text-xs space-y-1.5">
                      <div className="text-slate-500"><span className="text-purple-400">def</span> <span className="text-sky-400">bubble_sort</span>(arr):</div>
                      <div className="text-slate-500 pl-4"><span className="text-orange-400">for</span> i <span className="text-orange-400">in</span> <span className="text-green-400">range</span>(len(arr)):</div>
                      <div className="bg-violet-500/20 border-l-2 border-violet-400 pl-3 text-slate-300 -mx-1 rounded-r">
                        &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-orange-400">for</span> j <span className="text-orange-400">in</span> <span className="text-green-400">range</span>(n-i-1):
                      </div>
                      <div className="text-slate-600 pl-8">arr[j], arr[j+1] = ...</div>
                    </div>
                  )}
                  {pane === "STACK" && (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-xs font-mono">
                        <div className="text-violet-300 mb-1">bubble_sort</div>
                        <div className="text-slate-400">i = <span className="text-amber-300">2</span></div>
                        <div className="text-slate-400">j = <span className="text-amber-300">0</span></div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-white/3 p-2 text-xs font-mono opacity-40">
                        <div className="text-slate-400">main</div>
                      </div>
                    </div>
                  )}
                  {pane === "HEAP" && (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-2 text-xs font-mono">
                        <div className="text-teal-300 text-[10px] mb-1">list #o1</div>
                        <div className="flex gap-1">
                          {[3,1,4,1,5].map((n, i) => (
                            <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${i === 0 ? "bg-amber-500/30 text-amber-200" : "bg-white/5 text-slate-300"}`}>{n}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {pane === "OUTPUT" && (
                    <div className="font-mono text-xs text-green-400/80 space-y-1">
                      <div>Step 3 of 12</div>
                      <div className="text-slate-500">Comparing 3 and 1</div>
                      <div className="text-amber-300/80">Swapping → [1,3,4,1,5]</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Everything a young coder needs</h2>
          <p className="text-slate-500 text-center mb-16 text-lg">One platform from first loop to first algorithm</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-6 hover:bg-white/6 transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Age Themes */}
      <section className="py-24 px-6 bg-white/2">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Built for every age</h2>
          <p className="text-slate-500 mb-16 text-lg">Three adaptive learning environments</p>
          <div className="grid md:grid-cols-3 gap-6">
            {AGE_THEMES.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.12 }}
                className={`${t.color} rounded-3xl p-8 text-white text-left relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <div className="absolute top-4 right-4 text-4xl opacity-30">{t.emoji}</div>
                <div className="text-5xl mb-4">{t.emoji}</div>
                <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">{t.range}</div>
                <h3 className="text-2xl font-bold mb-2">{t.label}</h3>
                <p className="text-sm opacity-80 leading-relaxed">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-5xl font-black mb-6">Start learning today</h2>
          <p className="text-slate-400 text-lg mb-10">Free for students. Powerful for teachers.</p>
          <Link to={createPageUrl("Auth")}>
            <button className="px-10 py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-bold text-xl hover:opacity-90 transition-all shadow-2xl shadow-violet-500/30">
              Get Started Free →
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}