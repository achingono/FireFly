import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Code2, Loader2, ArrowRight, Sparkles, BookOpen, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ROLES = [
  { value: "student", label: "Student", emoji: "🎒", desc: "I want to learn coding" },
  { value: "teacher", label: "Teacher", emoji: "📚", desc: "I teach students" },
  { value: "parent", label: "Parent", emoji: "👨‍👩‍👧", desc: "My child is learning" },
];

const AGE_PROFILES = [
  { value: "fun", label: "Fun Mode", ages: "Ages 8–10", icon: Sparkles, desc: "Colorful, playful, guided", color: "from-amber-500 to-orange-500" },
  { value: "balanced", label: "Balanced", ages: "Ages 11–13", icon: BookOpen, desc: "Clean, helpful, progressive", color: "from-violet-500 to-fuchsia-500" },
  { value: "pro", label: "Pro Mode", ages: "Ages 14+", icon: Cpu, desc: "Dark IDE, minimal, advanced", color: "from-cyan-500 to-blue-500" },
];

type Step = "role" | "profile" | "name";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState("student");
  const [ageProfile, setAgeProfile] = useState("balanced");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      await client.auth.onboard({
        role,
        ageProfile,
        displayName: displayName || undefined,
        age,
      });
      await refreshUser();
      navigate(createPageUrl("Dashboard"), { replace: true });
    } catch (err) {
      setError((err as Error).message || "Failed to save profile");
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === "role") setStep("profile");
    else if (step === "profile") setStep("name");
    else handleComplete();
  };

  const buttonContent = step === "name" ? (
    <>Let's Go!</>
  ) : (
    <>
      Continue
      <ArrowRight className="w-4 h-4" />
    </>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(120,80,255,0.15),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">FireFly</span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6 justify-center">
          {(["role", "profile", "name"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-16 rounded-full transition-colors ${
                (["role", "profile", "name"] as Step[]).indexOf(step) >= i
                  ? "bg-violet-500"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === "role" && (
              <motion.div
                key="role"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">Welcome! Who are you?</h2>
                  <p className="text-slate-400 text-sm mt-1">This helps us personalize your experience</p>
                </div>

                <div className="space-y-3">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                        role === r.value
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-white/10 bg-white/3 hover:border-white/20"
                      }`}
                    >
                      <span className="text-2xl">{r.emoji}</span>
                      <div>
                        <div className="font-semibold text-white">{r.label}</div>
                        <div className="text-xs text-slate-400">{r.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">Choose your style</h2>
                  <p className="text-slate-400 text-sm mt-1">You can change this anytime in settings</p>
                </div>

                <div className="space-y-3">
                  {AGE_PROFILES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setAgeProfile(p.value)}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 ${
                        ageProfile === p.value
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-white/10 bg-white/3 hover:border-white/20"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                        <p.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{p.label}</div>
                        <div className="text-xs text-slate-400">{p.ages} · {p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {role === "student" && (
                  <div>
                    <label htmlFor="age-input" className="block text-sm text-slate-400 mb-1.5">Your age (optional)</label>
                    <input
                      type="number"
                      id="age-input"
                      min={5}
                      max={99}
                      value={age ?? ""}
                      onChange={(e) => setAge(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      placeholder="e.g. 12"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white">Almost there!</h2>
                  <p className="text-slate-400 text-sm mt-1">What should we call you?</p>
                </div>

                <div>
                  <label htmlFor="display-name-input" className="block text-sm text-slate-400 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    id="display-name-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name or nickname"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={nextStep}
            disabled={loading}
            className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white hover:opacity-90 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : buttonContent}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
