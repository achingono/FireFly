// ============================================================
// FireFly — Core Domain Types
// ============================================================

/** User roles in the system */
export type UserRole = "student" | "teacher" | "parent" | "admin";

/** Age-adaptive UI mode */
export type AgeProfile = "fun" | "balanced" | "pro";

/** Age range labels for each profile */
export const AGE_PROFILE_RANGES: Record<AgeProfile, string> = {
  fun: "8–10",
  balanced: "11–13",
  pro: "14+",
};

/** User preferences (stored per-user) */
export interface UserPreferences {
  theme: AgeProfile;
  soundEnabled: boolean;
  animationsEnabled: boolean;
}

/** Core User entity */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  age: number;
  ageProfile: AgeProfile;
  preferences: UserPreferences;
  avatarUrl?: string;
  parentEmail?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Concept in the curriculum graph */
export interface Concept {
  id: string;
  name: string;
  description: string;
  tags: string[];
  prerequisites: string[]; // Concept IDs
  difficulty: number; // 1-5
}

/** Lesson belonging to a concept */
export interface Lesson {
  id: string;
  conceptId: string;
  title: string;
  content: string; // markdown
  examples: CodeExample[];
  exercises: string[]; // Exercise IDs
  media: MediaItem[];
  llmPromptTemplates: Record<string, string>;
}

/** Code example within a lesson */
export interface CodeExample {
  id: string;
  title: string;
  code: string;
  language: string;
  explanation: string;
}

/** Media attachment for lessons */
export interface MediaItem {
  id: string;
  type: "image" | "video" | "animation";
  url: string;
  alt: string;
}

/** Exercise definition */
export interface Exercise {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  conceptTags: string[];
  starterCode: string;
  language: string;
  testCases: TestCase[];
  expectedTracePatterns: string[];
  rubric: string;
  difficulty: number; // 1-5
}

/** Test case for exercise validation */
export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

/** Mastery record per concept per user */
export interface MasteryRecord {
  userId: string;
  conceptId: string;
  score: number; // 0.0 – 1.0
  attempts: number;
  lastAttemptAt: string; // ISO 8601
  history: MasteryAttempt[];
}

/** Single mastery attempt */
export interface MasteryAttempt {
  timestamp: string; // ISO 8601
  score: number;
  exerciseId: string;
  correct: boolean;
}

/** Learning session for an exercise */
export interface LearningSession {
  id: string;
  userId: string;
  exerciseId: string;
  attempts: SessionAttempt[];
  hintsUsed: number;
  llmInteractions: LlmInteraction[];
  masteryDelta: number;
  startedAt: string; // ISO 8601
  endedAt?: string; // ISO 8601
}

/** Single attempt within a session */
export interface SessionAttempt {
  code: string;
  language: string;
  jobId: string;
  passed: boolean;
  submittedAt: string; // ISO 8601
}

/** LLM interaction record */
export interface LlmInteraction {
  prompt: string;
  response: string;
  type: "hint" | "explanation" | "question";
  timestamp: string; // ISO 8601
}

/** Execution job status */
export type JobStatus = "queued" | "running" | "completed" | "failed" | "timeout";

/** Execution job */
export interface ExecutionJob {
  jobId: string;
  status: JobStatus;
  language: string;
  estimatedMs?: number;
  result?: ExecutionResult;
}

/** Test case result */
export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

/** Execution result */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  memoryKb: number;
  testResults?: TestResult[];
}
