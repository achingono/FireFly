import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "@/lib/ThemeContext";

interface CodePaneProps {
  code: string;
  setCode: (code: string) => void;
  currentLine?: number;
  language: string;
}

export default function CodePane({ code, setCode, currentLine, language }: Readonly<CodePaneProps>) {
  const { isPro } = useTheme();
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<any>([]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (!editorRef.current || !currentLine) return;
    const editor = editorRef.current;

    // Highlight the current line
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: {
          startLineNumber: currentLine,
          startColumn: 1,
          endLineNumber: currentLine,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "bg-violet-500/15",
          linesDecorationsClassName: "border-l-2 border-violet-400",
        },
      },
    ]);

    // Scroll to the current line
    editor.revealLineInCenterIfOutsideViewport(currentLine);
  }, [currentLine]);

  return (
    <div className="flex flex-col overflow-hidden bg-muted h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Code</span>
        <span className="text-[10px] text-slate-600 font-mono ml-auto">{language}</span>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          theme={isPro ? "vs-dark" : "light"}
          value={code}
          onChange={(value) => setCode(value || "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: "on",
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            renderLineHighlight: "none",
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
        />
      </div>
    </div>
  );
}
