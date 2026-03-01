import { useState, useEffect } from "react";
import { client } from "@/api/client";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ChevronRight, Clock, Layers, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Concept {
  id: string;
  name: string;
  description?: string | null;
  difficulty: string;
  tags: string[];
  sortOrder: number;
  _count?: { lessons: number; masteryRecords: number };
}

// Color palette for concepts (rotate through)
const CONCEPT_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777",
  "#ea580c", "#0f172a", "#6366f1", "#14b8a6", "#f43f5e",
];

const CONCEPT_ICONS: Record<string, string> = {
  variables: "📦", loops: "🔁", functions: "⚙️", lists: "📋",
  recursion: "🌀", sorting: "🔀", conditionals: "🔀", search: "🔍",
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

export default function Curriculum() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
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
      } catch (err) {
        console.error("Failed to load concepts:", err);
        setError("Failed to load curriculum. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

              return (
                <motion.div
                  key={concept.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={createPageUrl(`Exercise?conceptId=${concept.id}`)}>
                    <div className="group rounded-2xl border border-white/8 bg-white/3 p-5 hover:bg-white/6 hover:border-white/15 transition-all cursor-pointer h-full flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: color + "22", border: `1px solid ${color}44` }}
                        >
                          {icon}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all mt-1" />
                      </div>
                      <h3 className="font-semibold text-base mb-1.5">{concept.name}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed flex-1 mb-4">
                        {concept.description ?? "No description available."}
                      </p>
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
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {concept.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-400">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </Link>
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
