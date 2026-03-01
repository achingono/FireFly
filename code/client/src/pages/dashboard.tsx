import { useState, useEffect } from "react";
import { progress, MasteryConcept } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trophy, Flame, Star, BookOpen, Code2, TrendingUp, Play, Clock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import MasteryMap from "@/components/dashboard/mastery-map";
import RecentActivity from "@/components/dashboard/recent-activity";
import ProgressRing from "@/components/dashboard/progress-ring";

export default function Dashboard() {
  const { user } = useAuth();
  const [concepts, setConcepts] = useState<MasteryConcept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const data = await progress.masteryMap(user.id);
        if (data?.concepts) {
          setConcepts(data.concepts);
        }
      } catch {
        // API unavailable — empty state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const xp = user?.xp ?? 0;
  const level = user?.level ?? 1;
  const streak = user?.streak ?? 0;

  // Derive stats from mastery data
  const masteredCount = concepts.filter((c) => c.mastered).length;
  const totalConcepts = concepts.length || 1; // avoid /0
  const overallProgress = Math.round(
    concepts.reduce((sum, c) => sum + c.score * 100, 0) / (totalConcepts * 100) * 100
  );

  // Transform concepts into format MasteryMap component expects
  const progressItems = concepts.map((c) => ({
    conceptId: c.conceptId,
    concept: c.conceptName,
    masteryScore: Math.round(c.score * 100),
    status: c.mastered ? "mastered" : c.attempts > 0 ? "in_progress" : "not_started",
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">
              Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {streak > 0 ? "Keep up your streak — you're on a roll." : "Start learning to build your streak!"}
            </p>
          </div>
          <Link to={createPageUrl("Visualizer")}>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors">
              <Play className="w-4 h-4" />
              Continue Learning
            </button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Star, label: "Total XP", value: xp.toLocaleString(), color: "from-amber-500 to-orange-600", sub: `Level ${level}` },
            { icon: Flame, label: "Day Streak", value: `${streak} days`, color: "from-rose-500 to-pink-600", sub: streak > 0 ? "Keep it up!" : "Start today!" },
            { icon: CheckCircle2, label: "Mastered", value: `${masteredCount} concepts`, color: "from-emerald-500 to-teal-600", sub: `of ${concepts.length} total` },
            { icon: TrendingUp, label: "Overall Progress", value: `${overallProgress}%`, color: "from-violet-500 to-fuchsia-600", sub: overallProgress > 50 ? "Great momentum" : "Keep going!" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold mb-0.5">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-muted-foreground/70 mt-1">{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Mastery map + progress ring */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MasteryMap progress={progressItems} />
          </div>
          <div>
            <ProgressRing progress={overallProgress} masteredCount={masteredCount} total={concepts.length} />
          </div>
        </div>

        {/* Recent activity */}
        <RecentActivity />

        {/* Quick actions — show in-progress concepts */}
        {concepts.filter((c) => c.attempts > 0 && !c.mastered).length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-4">Continue where you left off</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {concepts
                .filter((c) => c.attempts > 0 && !c.mastered)
                .slice(0, 3)
                .map((c, i) => (
                  <Link key={c.conceptId} to={`${createPageUrl("Exercise")}?conceptId=${c.conceptId}`}>
                    <div className="rounded-2xl border border-border bg-card p-5 hover:bg-card/80 transition-all group cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                          <Code2 className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{Math.round(c.score * 100)}%</span>
                      </div>
                      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{c.conceptName}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{c.attempts} attempt{c.attempts !== 1 ? "s" : ""}</p>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${Math.round(c.score * 100)}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
