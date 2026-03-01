import { useState } from "react";
import { client } from "@/api/client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Eye, EyeOff, Code2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ROLES = [
  { value: "student", label: "Student", emoji: "🎒", desc: "I want to learn coding" },
  { value: "teacher", label: "Teacher", emoji: "📚", desc: "I teach students" },
  { value: "admin", label: "Admin", emoji: "⚙️", desc: "I manage the platform" },
];

const AGE_GROUPS = [
  { value: "6-9", label: "6–9 years" },
  { value: "10-13", label: "10–13 years" },
  { value: "14-17", label: "14–17 years" },
];

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | register
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "", password: "", role: "student", ageGroup: "10-13", fullName: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        client.auth.redirectToLogin();
      } else {
        client.auth.redirectToLogin();
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(120,80,255,0.15),transparent)]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to={createPageUrl("Home")} className="inline-flex items-center gap-2 text-white">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">CodeSpark</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-black/30 p-1 mb-8">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all ${mode === m ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="Ada Lovelace"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@email.com"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="register-extras"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">I am a…</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, role: r.value }))}
                          className={`p-3 rounded-xl border text-center transition-all ${form.role === r.value ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20"}`}
                        >
                          <div className="text-xl mb-1">{r.emoji}</div>
                          <div className="text-xs font-semibold">{r.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.role === "student" && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Age Group</label>
                      <div className="grid grid-cols-3 gap-2">
                        {AGE_GROUPS.map((ag) => (
                          <button
                            key={ag.value}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, ageGroup: ag.value }))}
                            className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${form.ageGroup === ag.value ? "border-fuchsia-500 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/3 text-slate-400"}`}
                          >
                            {ag.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white hover:opacity-90 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}