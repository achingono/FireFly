import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { client, setToken } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Code2, Loader2, LogIn, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, refreshUser } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OIDC callback — token comes as ?token=xxx&onboarded=true/false
  useEffect(() => {
    const token = searchParams.get("token");
    const onboarded = searchParams.get("onboarded");

    if (token) {
      setProcessing(true);
      setToken(token);

      // Clean URL
      window.history.replaceState({}, "", "/Auth");

      // Reload user
      refreshUser().then(() => {
        if (onboarded === "false") {
          navigate("/Onboarding", { replace: true });
        } else {
          navigate(createPageUrl("Dashboard"), { replace: true });
        }
      }).catch(() => {
        setError("Failed to load user profile. Please try again.");
        setProcessing(false);
      });
    }
  }, [searchParams, navigate, refreshUser]);

  // If already authenticated, redirect
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && !processing) {
      navigate(createPageUrl("Dashboard"), { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, processing, navigate]);

  const handleLogin = () => {
    client.auth.redirectToLogin();
  };

  if (isLoadingAuth || processing) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
          <p className="text-slate-400 text-sm">
            {processing ? "Signing you in..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

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
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">FireFly</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          <div className="text-center space-y-3 mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome to FireFly</h1>
            <p className="text-slate-400 text-sm">
              Learn to code by watching it run. Step through your programs line by line.
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white hover:opacity-90 transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-3"
          >
            <LogIn className="w-5 h-5" />
            Sign In
          </button>

          <div className="mt-6 space-y-3">
            {[
              { icon: Sparkles, text: "Visual code stepper — see every line execute" },
              { icon: Code2, text: "Python, JavaScript, and more coming soon" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-500 text-xs">
                <item.icon className="w-4 h-4 flex-shrink-0 text-violet-500/60" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
