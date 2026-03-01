import { useState, useEffect } from "react";
import { client } from "@/api/client";
import { Users, TrendingUp, AlertCircle, BookOpen, Award, Eye, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const MOCK_STUDENTS = [
  { id: "u1", full_name: "Alex Chen", email: "alex@school.edu", xp: 1240, level: 5, streak: 7, masteryScore: 78, recentActivity: "Bubble Sort", status: "on_track" },
  { id: "u2", full_name: "Maya Patel", email: "maya@school.edu", xp: 890, level: 4, streak: 2, masteryScore: 55, recentActivity: "Functions", status: "on_track" },
  { id: "u3", full_name: "Sam Rodriguez", email: "sam@school.edu", xp: 320, level: 2, streak: 0, masteryScore: 22, recentActivity: "Variables", status: "needs_help" },
  { id: "u4", full_name: "Jordan Kim", email: "jordan@school.edu", xp: 2100, level: 8, streak: 14, masteryScore: 91, recentActivity: "Binary Search", status: "excelling" },
  { id: "u5", full_name: "Taylor Nguyen", email: "taylor@school.edu", xp: 670, level: 3, streak: 1, masteryScore: 41, recentActivity: "Loops", status: "needs_help" },
];

const MASTERY_DATA = [
  { concept: "Variables", class_avg: 82, top: 100, bottom: 45 },
  { concept: "Loops", class_avg: 64, top: 95, bottom: 20 },
  { concept: "Functions", class_avg: 55, top: 88, bottom: 15 },
  { concept: "Lists", class_avg: 48, top: 80, bottom: 10 },
  { concept: "Recursion", class_avg: 28, top: 70, bottom: 5 },
];

const STATUS_CONFIG = {
  on_track: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "On Track" },
  needs_help: { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Needs Help" },
  excelling: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Excelling" },
};

export default function TeacherDashboard() {
  const [students] = useState(MOCK_STUDENTS);
  const [selected, setSelected] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insight, setInsight] = useState(null);
  const [tab, setTab] = useState("overview");

  const getClassInsight = async () => {
    setLoadingInsight(true);
    const res = await client.integrations.Core.InvokeLLM({
      prompt: `You are an AI teaching assistant analyzing a class of 5 students learning programming. Here is their data:
- 2 students are on track (avg mastery 66%)
- 2 students need help (avg mastery 31%)
- 1 student is excelling (91% mastery)
- Common struggle area: Recursion (class avg 28%)
- 3 students have broken streak (no activity >2 days)

Provide a brief, actionable 2-3 sentence teaching insight for the teacher. Focus on what to prioritize this week.`,
    });
    setInsight(res);
    setLoadingInsight(false);
  };

  const classAvg = Math.round(students.reduce((s, st) => s + st.masteryScore, 0) / students.length);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black">Teacher Dashboard</h1>
            <p className="text-slate-500 mt-1">CS101 — Introduction to Programming</p>
          </div>
          <button
            onClick={getClassInsight}
            disabled={loadingInsight}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {loadingInsight ? <Loader2 className="w-4 h-4 animate-spin" /> : "✨"}
            AI Class Insight
          </button>
        </div>

        {insight && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-sm text-slate-300"
          >
            <span className="text-violet-300 font-semibold block mb-1">✨ AI Insight</span>
            {insight}
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: "Students", value: students.length, color: "from-sky-500 to-blue-600" },
            { icon: TrendingUp, label: "Class Avg Mastery", value: `${classAvg}%`, color: "from-emerald-500 to-teal-600" },
            { icon: AlertCircle, label: "Need Help", value: students.filter(s => s.status === "needs_help").length, color: "from-rose-500 to-pink-600" },
            { icon: Award, label: "Excelling", value: students.filter(s => s.status === "excelling").length, color: "from-amber-500 to-orange-600" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border border-white/8 bg-white/3 p-5"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-black/30 w-fit mb-6">
          {["overview", "students", "analytics"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Mastery bar chart */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
              <h2 className="font-semibold mb-4">Class Mastery by Concept</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={MASTERY_DATA} barGap={4}>
                  <XAxis dataKey="concept" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e2e8f0" }}
                  />
                  <Bar dataKey="class_avg" radius={[6, 6, 0, 0]}>
                    {MASTERY_DATA.map((entry, i) => (
                      <Cell key={i} fill={entry.class_avg >= 70 ? "#10b981" : entry.class_avg >= 40 ? "#f59e0b" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Students needing help */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
              <h2 className="font-semibold mb-4">Students Needing Attention</h2>
              <div className="space-y-3">
                {students.filter(s => s.status === "needs_help").map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/8 border border-rose-500/20">
                    <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center text-sm font-bold">
                      {s.full_name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{s.full_name}</div>
                      <div className="text-xs text-slate-500">Last: {s.recentActivity} · {s.streak === 0 ? "No streak" : `${s.streak}d streak`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-rose-400">{s.masteryScore}%</div>
                      <div className="text-xs text-slate-600">mastery</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "students" && (
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Student</th>
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Level / XP</th>
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Mastery</th>
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Streak</th>
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map(s => {
                  const sc = STATUS_CONFIG[s.status];
                  return (
                    <tr key={s.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold">
                            {s.full_name[0]}
                          </div>
                          <div>
                            <div className="font-medium">{s.full_name}</div>
                            <div className="text-xs text-slate-600">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold">Lv.{s.level}</span>
                        <span className="text-slate-500 ml-1 text-xs">· {s.xp.toLocaleString()} XP</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-white/8">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${s.masteryScore}%` }} />
                          </div>
                          <span className="text-xs">{s.masteryScore}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={s.streak > 0 ? "text-amber-400" : "text-slate-600"}>{s.streak > 0 ? `🔥 ${s.streak}d` : "—"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{s.recentActivity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "analytics" && (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center text-slate-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Detailed analytics — coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}