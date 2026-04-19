import { Link } from "react-router-dom";
import { ChevronRight, Clock, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import type { MasteryConcept } from "@/api/client";

export interface Concept {
  id: string;
  name: string;
  description?: string | null;
  difficulty: string;
  tags: string[];
  sortOrder: number;
  prerequisites: string[];
  _count?: { lessons: number; masteryRecords: number };
}

export const CONCEPT_COLORS = [
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

interface ConceptCardProps {
  concept: Concept;
  color: string;
  isUnlocked: boolean;
  mastery: MasteryConcept | undefined;
  unmetPrereqs: string[];
  index: number;
}

export function ConceptCard({ concept, color, isUnlocked, mastery, unmetPrereqs, index }: Readonly<ConceptCardProps>) {
  const icon = getConceptIcon(concept.name);
  const diffColor = DIFF_COLORS[concept.difficulty as keyof typeof DIFF_COLORS] ?? "slate";
  const lessonCount = concept._count?.lessons ?? 0;
  const isMastered = mastery?.mastered ?? false;
  const masteryScore = mastery ? Math.round(mastery.score * 100) : 0;

  const cardContent = (
    <div className={`group rounded-2xl border p-5 h-full flex flex-col transition-all ${
      isUnlocked
        ? "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 cursor-pointer"
        : "border-white/5 bg-white/[0.01] opacity-55 cursor-not-allowed"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isUnlocked ? "" : "grayscale"}`}
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
      <h3 className={`font-semibold text-base mb-1.5 ${isUnlocked ? "" : "text-slate-500"}`}>
        {concept.name}
      </h3>
      <p className="text-slate-500 text-xs leading-relaxed flex-1 mb-4">
        {concept.description ?? "No description available."}
      </p>

      {isUnlocked && mastery && mastery.attempts > 0 && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isMastered ? "bg-emerald-500" : "bg-violet-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${masteryScore}%` }}
              transition={{ duration: 0.8, delay: index * 0.05 }}
            />
          </div>
        </div>
      )}

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
            {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
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
}
