import { useEffect, useRef } from "react";
import {
  SkipBack, ChevronLeft, ChevronRight, SkipForward,
  Play, Pause, Sparkles
} from "lucide-react";

const EVENT_COLORS = {
  call: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  return: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  line: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  assign: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  exception: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  io: "bg-sky-500/20 text-sky-300 border-sky-500/30",
};

export default function StepperControls({
  currentStep, totalFrames, onStep, isPlaying, setIsPlaying, onExplain, currentFrame
}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        onStep(prev => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 600);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, totalFrames]);

  const progress = totalFrames > 1 ? (currentStep / (totalFrames - 1)) * 100 : 0;
  const event = currentFrame?.event ?? "line";
  const eventClass = EVENT_COLORS[event] ?? EVENT_COLORS.line;

  return (
    <div className="border-t border-white/8 bg-[#0d0d14] px-5 py-3">
      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full bg-white/8 mb-3 cursor-pointer relative group"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onStep(Math.round(pct * (totalFrames - 1)));
        }}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow transition-all opacity-0 group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => onStep(0)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="mx-1 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shadow"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={() => onStep(s => Math.min(totalFrames - 1, s + 1))}
            disabled={currentStep >= totalFrames - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => onStep(totalFrames - 1)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Step info */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-mono">
            <span className="text-white">{currentStep + 1}</span>/{totalFrames}
          </span>
          {currentFrame && (
            <>
              <span>·</span>
              <span className="font-mono text-slate-600">line {currentFrame.line}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] border font-semibold ${eventClass}`}>{event}</span>
            </>
          )}
        </div>

        {/* AI explain */}
        <button
          onClick={onExplain}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-semibold hover:bg-violet-500/25 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Explain this step
        </button>
      </div>
    </div>
  );
}