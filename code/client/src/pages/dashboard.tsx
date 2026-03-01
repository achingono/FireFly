import { useState, useEffect } from "react";
import { client, User } from "@/api/client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trophy, Flame, Star, BookOpen, Code2, TrendingUp, Play, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import MasteryMap from "@/components/dashboard/mastery-map";
import RecentActivity from "@/components/dashboard/recent-activity";
import ProgressRing from "@/components/dashboard/progress-ring";

const MOCK_PROGRESS = [
  { conceptId: "c1", concept: "Variables", masteryScore: 90, status: "mastered" },
  { conceptId: "c2", concept: "Loops", masteryScore: 65, status: "in_progress" },
  { conceptId: "c3", concept: "Functions", masteryScore: 40, status: "in_progress" },
  { conceptId: "c4", concept: "Lists", masteryScore: 10, status: "in_progress" },
  { conceptId: "c5", concept: "Recursion", masteryScore: 0, status: "not_started" },
  { conceptId: "c6", concept: "Sorting", masteryScore: 0, status: "not_started" },
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState(MOCK_PROGRESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const u = await client.auth.me().catch(() => null);
      setUser(u);
      const prog = await client.entities.Progress.list("-updated_date", 10).catch(() => [] as unknown[]);
      if (prog.length > 0) setProgress(prog as typeof MOCK_PROGRESS);
      setLoading(false);
    };
    load();
  }, []);

  const xp = user?.xp ?? 1240;
  const level = user?.level ?? 5;
  const streak = user?.streak ?? 7;
  const masteredCount = progress.filter(p => p.status === "mastered").length;
  const overallProgress = Math.round(progress.reduce((s, p) => s + (p.masteryScore ?? 0), 0) / (progress.length * 100) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">
              Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}! 👋
            </h1>
            <p className="text-slate-500 mt-1">Keep up your streak — you're on a roll.</p>
          </div>
          <Link to={createPageUrl("Visualizer")}>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-sm transition-colors">
              <Play className="w-4 h-4" />
              Continue Learning
            </button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Star, label: "Total XP", value: xp.toLocaleString(), color: "from-amber-500 to-orange-600", sub: `Level ${level}` },
            { icon: Flame, label: "Day Streak", value: `${streak} days`, color: "from-rose-500 to-pink-600", sub: "Keep it up!" },
            { icon: CheckCircle2, label: "Mastered", value: `${masteredCount} concepts`, color: "from-emerald-500 to-teal-600", sub: `of ${progress.length} total` },
            { icon: TrendingUp, label: "Overall Progress", value: `${overallProgress}%`, color: "from-violet-500 to-fuchsia-600", sub: "Great momentum" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/8 bg-white/3 p-5"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold mb-0.5">{stat.value}</div>
              <div className="text-sm text-slate-500">{stat.label}</div>
              <div className="text-xs text-slate-600 mt-1">{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Mastery map + progress ring */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MasteryMap progress={progress} />
          </div>
          <div>
            <ProgressRing progress={overallProgress} masteredCount={masteredCount} total={progress.length} />
          </div>
        </div>

        {/* Recent activity */}
        <RecentActivity />

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-bold mb-4">Continue where you left off</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Bubble Sort", concept: "Sorting Algorithms", progress: 30, lang: "Python", color: "#7c3aed" },
              { title: "Fibonacci Recursion", concept: "Recursion", progress: 0, lang: "Python", color: "#db2777" },
              { title: "Array Methods", concept: "Lists & Arrays", progress: 75, lang: "JavaScript", color: "#d97706" },
            ].map((ex, i) => (
              <Link key={i} to={createPageUrl("Exercise")}>
                <div className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:bg-white/6 transition-all group cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ex.color + "22" }}>
                      <Code2 className="w-5 h-5" style={{ color: ex.color }} />
                    </div>
                    <span className="text-xs text-slate-600 font-mono">{ex.lang}</span>
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-white transition-colors">{ex.title}</h3>
                  <p className="text-xs text-slate-500 mb-3">{ex.concept}</p>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${ex.progress}%` }} />
                  </div>
                  <div className="text-xs text-slate-600 mt-1.5">{ex.progress}% complete</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}