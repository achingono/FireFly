import { useState, useEffect } from "react";
import { client, progress, MasteryConcept } from "@/api/client";
import { Search, Layers, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ConceptCard, CONCEPT_COLORS } from "@/components/curriculum";
import type { Concept } from "@/components/curriculum";

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
            {filtered.map((concept, i) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                color={CONCEPT_COLORS[i % CONCEPT_COLORS.length]}
                isUnlocked={unlockedSet.has(concept.id)}
                mastery={masteryMap.get(concept.id)}
                unmetPrereqs={unlockedSet.has(concept.id) ? [] : getUnmetPrereqNames(concept, conceptsById, masteryMap)}
                index={i}
              />
            ))}
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
