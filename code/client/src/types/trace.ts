// ============================================================
// FireFly — Trace Schema Types (SPEC §12)
// ============================================================

/** Top-level trace object returned by the execution engine */
export interface Trace {
  traceVersion: string;
  jobId: string;
  language: string;
  frames: TraceFrame[];
  metadata: TraceMetadata;
}

/** Trace event types */
export type TraceEvent = "line" | "call" | "return" | "exception" | "assign" | "io";

/** Single execution frame */
export interface TraceFrame {
  step: number;
  timeMs: number;
  file: string;
  line: number;
  event: TraceEvent;
  stack: StackFrame[];
  heap: HeapObject[];
  stdout: string;
  stderr: string;
}

/** Stack frame within a trace step */
export interface StackFrame {
  frameId: string;
  name: string;
  locals: Record<string, unknown>;
}

/** Heap object with stable ID for cross-frame tracking */
export interface HeapObject {
  id: string;
  type: string;
  value: unknown;
  repr: string;
}

/** Trace-level metadata */
export interface TraceMetadata {
  durationMs: number;
  maxMemoryKb: number;
  totalSteps: number;
}
