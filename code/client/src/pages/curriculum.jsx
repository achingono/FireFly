import { useState, useEffect } from "react";
import { client } from "@/api/client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Filter, ChevronRight, Star, Clock, Layers } from "lucide-react";
import { motion } from "framer-motion";

const MOCK_CONCEPTS = [
  { id: "c1", title: "Variables & Data Types", slug: "variables", difficulty: "beginner", tags: ["fundamentals"], ageGroups: ["6-9","10-13"], iconEmoji: "📦", color: "#7c3aed", estimatedMinutes: 20, description: "Learn how to store and use values in your programs." },
  { id: "c2", title: "Loops & Iteration", slug: "loops", difficulty: "beginner", tags: ["control-flow"], ageGroups: ["10-13","14-17"], iconEmoji: "🔁", color: "#0891b2", estimatedMinutes: 30, description: "Repeat actions efficiently with for and while loops." },
  { id: "c3", title: "Functions", slug: "functions", difficulty: "beginner", tags: ["fundamentals"], ageGroups: ["10-13","14-17"], iconEmoji: "⚙️", color: "#059669", estimatedMinutes: 35, description: "Package reusable blocks of code into named functions." },
  { id: "c4", title: "Lists & Arrays", slug: "lists", difficulty: "beginner", tags: ["data-structures"], ageGroups: ["10-13","14-17"], iconEmoji: "📋", color: "#d97706", estimatedMinutes: 25, description: "Store ordered collections of items in memory." },
  { id: "c5", title: "Recursion", slug: "recursion", difficulty: "intermediate", tags: ["algorithms"], ageGroups: ["14-17"], iconEmoji: "🌀", color: "#db2777", estimatedMinutes: 45, description: "Solve problems by having functions call themselves." },
  { id: "c6", title: "Sorting Algorithms", slug: "sorting", difficulty: "intermediate", tags: ["algorithms","data-structures"], ageGroups: ["14-17"], iconEmoji: "🔀", color: "#7c3aed", estimatedMinutes: 60, description: "Bubble, merge, and quick sort — visualized step by step." },
  { id: "c7", title: "Conditionals", slug: "conditionals", difficulty: "beginner", tags: ["control-flow"], ageGroups: ["6-9","10-13"], iconEmoji: "🔀", color: "#ea580c", estimatedMinutes: 20, description: "Make decisions in your code with if/else statements." },
  { id: "c8", title: "Binary Search", slug: "binary-search", difficulty: "advanced", tags: ["algorithms"], ageGroups: ["14-17"], iconEmoji: "🔍", color: "#0f172a", estimatedMinutes: 50, description: "Find items in sorted arrays in logarithmic time." },
];

const DIFF_COLORS = { beginner: "emerald", intermediate: "amber", advanced: "rose" };

export default function Curriculum() {
  const [concepts, setConcepts] = useState(MOCK_CONCEPTS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ difficulty: "all", ageGroup: "all" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await client.entities.Concept.list();
      if (data.length > 0) setConcepts(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = concepts.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchDiff = filter.difficulty === "all" || c.difficulty === filter.difficulty;
    const matchAge = filter.ageGroup === "all" || c.ageGroups?.includes(filter.ageGroup);
    return matchSearch && matchDiff && matchAge;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-4 py-8">
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
          <select
            value={filter.ageGroup}
            onChange={e => setFilter(p => ({ ...p, ageGroup: e.target.value }))}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 focus:outline-none"
          >
            <option value="all">All Ages</option>
            <option value="6-9">Ages 6–9</option>
            <option value="10-13">Ages 10–13</option>
            <option value="14-17">Ages 14–17</option>
          </select>
        </div>

        {/* Concepts grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((concept, i) => (
            <motion.div
              key={concept.id || concept.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={createPageUrl(`Exercise?conceptId=${concept.id || concept.slug}`)}>
                <div className="group rounded-2xl border border-white/8 bg-white/3 p-5 hover:bg-white/6 hover:border-white/15 transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: concept.color + "22", border: `1px solid ${concept.color}44` }}
                    >
                      {concept.iconEmoji || "📌"}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all mt-1" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">{concept.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed flex-1 mb-4">{concept.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${DIFF_COLORS[concept.difficulty]}-500/15 text-${DIFF_COLORS[concept.difficulty]}-400`}>
                      {concept.difficulty}
                    </span>
                    {concept.estimatedMinutes && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {concept.estimatedMinutes}m
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {concept.ageGroups?.map(ag => (
                      <span key={ag} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-400">{ag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-24 text-slate-600">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No concepts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}