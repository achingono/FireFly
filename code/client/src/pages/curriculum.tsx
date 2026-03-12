import { useState, useEffect } from "react";
import { client, progress, MasteryConcept } from "@/api/client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ChevronRight, Clock, Layers, Loader2, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

interface Concept {
  id: string;
  name: string;
  description?: string | null;
  difficulty: string;
  tags: string[];
  sortOrder: number;
  prerequisites: string[];
  _count?: { lessons: number; masteryRecords: number };
}

// Color palette for concepts (rotate through)
const CONCEPT_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777",
  "#ea580c", "#0f172a", "#6366f1", "#14b8a6", "#f43f5e",
];

const CONCEPT_ICONS: Record<string, string> = {
  variables: "📦", "data types": "🔢", operators: "➕", loops: "🔁",
  functions: "⚙️", lists: "📋", dictionaries: "📖", conditionals: "🔀",
  recursion: "🌀", sorting: "🔀", search: "🔍",
  default: "📌",
};

const DIFF_COLORS = { beginner: "emerald", intermediate: "amber", advanced: "rose" };

function getConceptIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CONCEPT_ICONS)) {
    if (key !== "default" && lower.includes(key)) return icon;
  }
  return CONCEPT_ICONS.default;
}

/** Determine which concepts are unlocked based on prerequisite mastery */
function computeUnlockedSet(
  concepts: Concept[],
  masteryMap: Map<string, MasteryConcept>
): Set<string> {
  const unlocked = new Set<string>();

  for (const concept of concepts) {
    // No prerequisites — always unlocked
    if (!concept.prerequisites || concept.prerequisites.length === 0) {
      unlocked.add(concept.id);
      continue;
    }

    // All prerequisites must be mastered (score >= 0.80)
    const allPrereqsMet = concept.prerequisites.every((prereqId) => {
      const mastery = masteryMap.get(prereqId);
      return mastery?.mastered;
    });

    if (allPrereqsMet) {
      unlocked.add(concept.id);
    }
  }

  return unlocked;
}

/** Get the names of unmet prerequisites for a locked concept */
function getUnmetPrereqNames(
  concept: Concept,
  conceptsById: Map<string, Concept>,
  masteryMap: Map<string, MasteryConcept>
): string[] {
  if (!concept.prerequisites) return [];
  return concept.prerequisites
    .filter((prereqId) => {
      const mastery = masteryMap.get(prereqId);
      return !mastery?.mastered;
    })
    .map((prereqId) => conceptsById.get(prereqId)?.name ?? "Unknown")
    .filter(Boolean);
}

export default function Curriculum() {
  const { user } = useAuth();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [masteryMap, setMasteryMap] = useState<Map<string, MasteryConcept>>(new Map());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ difficulty: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await client.entities.concepts.list() as Concept[];
        setConcepts(data);

        // Fetch mastery data if user is logged in
        if (user?.id) {
          try {
            const mastery = await progress.masteryMap(user.id);
            if (mastery?.concepts) {
              const map = new Map<string, MasteryConcept>();
              for (const c of mastery.concepts) {
                map.set(c.conceptId, c);
              }
              setMasteryMap(map);
            }
          } catch {
            // Mastery data unavailable — treat all as unlocked (graceful degradation)
          }
        }
      } catch (err) {
        console.error("Failed to load concepts:", err);
        setError("Failed to load curriculum. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const unlockedSet = computeUnlockedSet(concepts, masteryMap);
  const conceptsById = new Map(concepts.map((c) => [c.id, c]));

  const filtered = concepts.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = filter.difficulty === "all" || c.difficulty === filter.difficulty;
    return matchSearch && matchDiff;
  });

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black mb-2">Curriculum</h1>
          <p className="text-slate-500 text-lg">Master programming concepts step by step</p>
        </div>

        {/* Search & Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search concepts…"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <select
            value={filter.difficulty}
            onChange={e => setFilter(p => ({ ...p, difficulty: e.target.value }))}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-24">
            <Loader2 className="w-8 h-8 mx-auto mb-4 text-violet-400 animate-spin" />
            <p className="text-slate-500">Loading curriculum…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-24 text-slate-500">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{error}</p>
          </div>
        )}

        {/* Concepts grid */}
        {!loading && !error && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((concept, i) => {
              const color = CONCEPT_COLORS[i % CONCEPT_COLORS.length];
              const icon = getConceptIcon(concept.name);
              const diffColor = DIFF_COLORS[concept.difficulty as keyof typeof DIFF_COLORS] ?? "slate";
              const lessonCount = concept._count?.lessons ?? 0;
              const isUnlocked = unlockedSet.has(concept.id);
              const mastery = masteryMap.get(concept.id);
              const isMastered = mastery?.mastered ?? false;
              const masteryScore = mastery ? Math.round(mastery.score * 100) : 0;
              const unmetPrereqs = !isUnlocked
                ? getUnmetPrereqNames(concept, conceptsById, masteryMap)
                : [];

              const cardContent = (
                <div className={`group rounded-2xl border p-5 h-full flex flex-col transition-all ${
                  isUnlocked
                    ? "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 cursor-pointer"
                    : "border-white/5 bg-white/[0.01] opacity-55 cursor-not-allowed"
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${!isUnlocked ? "grayscale" : ""}`}
                      style={{ backgroundColor: color + "22", border: `1px solid ${color}44` }}
                    >
                      {isUnlocked ? icon : "🔒"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {isMastered && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {isUnlocked && masteryScore > 0 && !isMastered && (
                        <span className="text-xs font-bold text-violet-400">{masteryScore}%</span>
                      )}
                      {isUnlocked ? (
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  </div>
                  <h3 className={`font-semibold text-base mb-1.5 ${!isUnlocked ? "text-slate-500" : ""}`}>
                    {concept.name}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed flex-1 mb-4">
                    {concept.description ?? "No description available."}
                  </p>

                  {/* Mastery progress bar for unlocked concepts */}
                  {isUnlocked && mastery && mastery.attempts > 0 && (
                    <div className="mb-3">
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${isMastered ? "bg-emerald-500" : "bg-violet-500"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${masteryScore}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Locked: show prerequisite requirements */}
                  {!isUnlocked && unmetPrereqs.length > 0 && (
                    <div className="mb-3 flex items-start gap-1.5 text-[10px] text-amber-400/70">
                      <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Master {unmetPrereqs.join(" & ")} to unlock</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${diffColor}-500/15 text-${diffColor}-400`}>
                      {concept.difficulty}
                    </span>
                    {lessonCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isMastered && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                        mastered
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {concept.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-400">{tag}</span>
                    ))}
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={concept.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {isUnlocked ? (
                    <Link to={createPageUrl(`Exercise?conceptId=${concept.id}`)}>
                      {cardContent}
                    </Link>
                  ) : (
                    cardContent
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-24 text-slate-600">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>{concepts.length === 0 ? "No concepts found. Seed the database to get started." : "No concepts match your filters"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
