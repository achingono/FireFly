import { useState, useCallback } from "react";
import { client } from "@/api/client";
import CodePane from "@/components/visualizer/code-pane";
import StackPane from "@/components/visualizer/stack-pane";
import HeapPane from "@/components/visualizer/heap-pane";
import OutputPane from "@/components/visualizer/output-pane";
import StepperControls from "@/components/visualizer/stepper-controls";
import AiExplainPanel from "@/components/visualizer/ai-explain-panel";
import { MOCK_TRACE } from "@/components/visualizer/mock-trace";
import { Play, RotateCcw, Settings2, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STARTER_PROGRAMS = {
  python: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

arr = [64, 34, 25, 12, 22, 11, 90]
result = bubble_sort(arr)
print(result)`,
  javascript: `function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j+1]] = [arr[j+1], arr[j]];
      }
    }
  }
  return arr;
}

const arr = [64, 34, 25, 12, 22, 11, 90];
console.log(bubbleSort(arr));`,
};

export default function Visualizer() {
  const [code, setCode] = useState(STARTER_PROGRAMS.python);
  const [language, setLanguage] = useState("python");
  const [trace, setTrace] = useState(MOCK_TRACE);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [ageProfile, setAgeProfile] = useState("10-13");

  const currentFrame = trace?.frames?.[currentStep] ?? null;
  const totalFrames = trace?.frames?.length ?? 0;

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setCurrentStep(0);
    // Simulate execution delay then use mock trace
    await new Promise(r => setTimeout(r, 800));
    setTrace(MOCK_TRACE);
    setCurrentStep(0);
    setIsRunning(false);
  }, []);

  const handleExplain = useCallback(async () => {
    if (!currentFrame) return;
    setShowAi(true);
    setLoadingAi(true);
    setAiExplanation(null);
    const res = await client.integrations.Core.InvokeLLM({
      prompt: `You are a coding tutor for a ${ageProfile} year old student. Explain what is happening at this code execution step in a friendly, age-appropriate way. Keep it to 2-3 sentences max. Use a simple analogy if helpful.

Code line: ${currentFrame.file} line ${currentFrame.line}
Event: ${currentFrame.event}
Stack variables: ${JSON.stringify(currentFrame.stack?.[0]?.locals ?? {})}
Stdout so far: "${currentFrame.stdout || 'none'}"

Tone: friendly, encouraging, ${ageProfile === "6-9" ? "very simple with emojis" : ageProfile === "10-13" ? "casual and clear" : "technical but approachable"}`,
    });
    setAiExplanation(res);
    setLoadingAi(false);
  }, [currentFrame, ageProfile]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/8 bg-[#0d0d14]">
        <Link to={createPageUrl("Home")} className="text-slate-500 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Code Visualizer</span>
          <span className="text-slate-600 text-xs">— bubble sort demo</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Language */}
          <select
            value={language}
            onChange={e => { setLanguage(e.target.value); setCode(STARTER_PROGRAMS[e.target.value as keyof typeof STARTER_PROGRAMS]); setTrace(MOCK_TRACE); setCurrentStep(0); }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 focus:outline-none"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
          {/* Age profile */}
          <select
            value={ageProfile}
            onChange={e => setAgeProfile(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 focus:outline-none"
          >
            <option value="6-9">Age 6–9</option>
            <option value="10-13">Age 10–13</option>
            <option value="14-17">Age 14–17</option>
          </select>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {isRunning ? (
              <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Running…</>
            ) : (
              <><Play className="w-3.5 h-3.5" />Run</>
            )}
          </button>
          <button
            onClick={() => { setCurrentStep(0); setTrace(MOCK_TRACE); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 4-pane grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_260px_260px_1fr] divide-x divide-white/5 overflow-hidden" style={{ minHeight: 0 }}>
        <CodePane code={code} setCode={setCode} currentLine={currentFrame?.line} language={language} />
        <StackPane frames={currentFrame?.stack ?? []} />
        <HeapPane objects={currentFrame?.heap ?? []} />
        <OutputPane stdout={currentFrame?.stdout ?? ""} stderr={currentFrame?.stderr ?? ""} step={currentStep} total={totalFrames} />
      </div>

      {/* Stepper */}
      <StepperControls
        currentStep={currentStep}
        totalFrames={totalFrames}
        onStep={setCurrentStep}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onExplain={handleExplain}
        currentFrame={currentFrame}
      />

      {/* AI explain panel */}
      <AiExplainPanel
        show={showAi}
        onClose={() => setShowAi(false)}
        explanation={aiExplanation}
        loading={loadingAi}
        ageProfile={ageProfile}
        frame={currentFrame}
      />
    </div>
  );
}