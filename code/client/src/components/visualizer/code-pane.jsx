import { useEffect, useRef } from "react";

export default function CodePane({ code, setCode, currentLine, language }) {
  const lines = code.split("\n");
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentLine]);

  return (
    <div className="flex flex-col overflow-hidden bg-[#0d0d14]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Code</span>
        <span className="text-[10px] text-slate-600 font-mono ml-auto">{language}</span>
      </div>
      <div className="flex-1 overflow-auto relative">
        <div className="absolute inset-0 flex">
          {/* Line numbers */}
          <div className="shrink-0 w-10 border-r border-white/5 bg-black/20 pt-3 pb-10">
            {lines.map((_, i) => (
              <div
                key={i}
                className={`h-6 flex items-center justify-end pr-3 text-[11px] font-mono transition-colors ${i + 1 === currentLine ? "text-violet-400" : "text-slate-700"}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {/* Code lines */}
          <div className="flex-1 pt-3 pb-10 overflow-x-auto">
            {lines.map((line, i) => (
              <div
                key={i}
                ref={i + 1 === currentLine ? activeRef : null}
                className={`h-6 flex items-center px-4 text-[13px] font-mono whitespace-pre transition-colors ${
                  i + 1 === currentLine
                    ? "bg-violet-500/15 border-l-2 border-violet-400"
                    : "border-l-2 border-transparent"
                }`}
              >
                <CodeLine line={line} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeLine({ line }) {
  // Basic syntax colouring
  const colored = line
    .replace(/(def|return|for|in|if|else|elif|while|import|from|class|pass|and|or|not|True|False|None)\b/g, '<kw>$1</kw>')
    .replace(/("[^"]*"|'[^']*')/g, '<str>$1</str>')
    .replace(/\b(\d+)\b/g, '<num>$1</num>')
    .replace(/(#.*)/g, '<cmt>$1</cmt>')
    .replace(/\b([a-zA-Z_]+)\s*(?=\()/g, '<fn>$1</fn>');

  const parts = [];
  let remaining = colored;
  const tagRe = /<(kw|str|num|cmt|fn)>(.*?)<\/\1>/g;
  let lastIdx = 0;
  let match;
  while ((match = tagRe.exec(remaining)) !== null) {
    if (match.index > lastIdx) parts.push({ type: "plain", text: remaining.slice(lastIdx, match.index) });
    parts.push({ type: match[1], text: match[2] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) parts.push({ type: "plain", text: remaining.slice(lastIdx) });

  const colorMap = { kw: "text-fuchsia-400", str: "text-emerald-400", num: "text-amber-300", cmt: "text-slate-600 italic", fn: "text-sky-400", plain: "text-slate-300" };

  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={colorMap[p.type] || "text-slate-300"}>{p.text}</span>
      ))}
    </>
  );
}