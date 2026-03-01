# FireFly — Product Specification

> An AI-powered, mastery-based coding education platform for kids that visually steps through code execution, adapts to the learner's age, and teaches programming concepts through demonstrated understanding.

**Version**: 1.0  
**Last updated**: 2026-03-01  
**Status**: Active development — MVP phase

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Target Users & Age Profiles](#2-target-users--age-profiles)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Core Features](#5-core-features)
6. [Visual Code Stepper (Primary Feature)](#6-visual-code-stepper-primary-feature)
7. [Memory Animation (Bonus Feature)](#7-memory-animation-bonus-feature)
8. [Adaptive UI Engine](#8-adaptive-ui-engine)
9. [AI Integration](#9-ai-integration)
10. [Adaptive Learning & Mastery](#10-adaptive-learning--mastery)
11. [API Contract](#11-api-contract)
12. [Trace Schema](#12-trace-schema)
13. [Data Model](#13-data-model)
14. [Security, Privacy & Compliance](#14-security-privacy--compliance)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Success Metrics](#17-success-metrics)

---

## 1. Vision & Goals

FireFly is a web platform where children (ages 8+) learn programming concepts through:

1. **Concept-focused lessons** tied to what they're currently learning (variables → loops → functions → lists → OOP basics).
2. **Mastery-based progression** — the next concept unlocks only after demonstrated understanding (≥ 80% mastery score).
3. **Online code execution** — safe, sandboxed run with input/output.
4. **Visual code stepper** (**primary feature**) — line-by-line execution highlighting with animated stack, heap, variables, pointers, and I/O panels. Modeled after [Python Tutor](https://pythontutor.com).
5. **Creative memory animation** (bonus) — an optional visual layer showing what's happening inside the computer's memory, rendered as metaphorical scenes for younger kids or realistic schematics for older learners.

The platform adapts its entire UI, tone, and visuals to the learner's age profile and is fully customizable by parents/kids.

### Non-Goals (MVP)

- Full IDE or collaborative editing
- Native mobile app (responsive web first)
- Multi-language support beyond Python and JavaScript

---

## 2. Target Users & Age Profiles

| Profile | Age | Mode Name | UI Character |
|---------|-----|-----------|--------------|
| Young learners | 8–10 | **Fun Mode** | Large fonts, bright colors, mascots ("Byte the Robot"), confetti, story-driven worlds, sound effects |
| Middle learners | 11–13 | **Balanced Mode** | Clean visuals with optional friendly icons, guided hints, progress badges |
| Teen learners | 14+ | **Pro Mode** | Dark theme, minimal animations, real-IDE look (VS Code Dark+), memory addresses, keyboard shortcuts, hex dumps |

- **Default** is set by age at signup; parent override and kid-controlled toggle available at any time.
- Parent PIN lock for under-13 profile settings (COPPA).
- All modes share the same underlying execution and trace engine — only the visual/audio layer changes.

### Additional Roles

| Role | Access |
|------|--------|
| **Student** | Lessons, editor, visualizer, progress dashboard |
| **Teacher** | Student progress, common misconceptions, intervention recommendations, content management |
| **Parent** | Child progress, theme/customization controls, consent management |
| **Admin** | Analytics, seeding, system configuration |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend SPA (React + Vite + TypeScript)                   │
│  ├── Monaco Code Editor                                     │
│  ├── Visual Stepper UI (Code / Stack / Heap / Output panes) │
│  ├── Memory Animation Canvas (PixiJS / Three.js)            │
│  ├── AI Tutor Sidebar                                       │
│  └── Adaptive UI Engine (React Context + Tailwind themes)   │
│       └── Fun / Balanced / Pro mode switching                │
└────────────────────────┬────────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│  Backend API (Node.js + Fastify + TypeScript)               │
│  ├── Auth (JWT, role-based access)                          │
│  ├── Curriculum & Lesson Service                            │
│  ├── Progress & Mastery Service (BKT scoring)               │
│  ├── Execution Orchestrator                                 │
│  ├── Trace Generator & Transformer                          │
│  └── LLM Proxy (configurable provider)                      │
└──────┬─────────────┬──────────────┬─────────────────────────┘
       │             │              │
┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
│ PostgreSQL  │ │  Redis   │ │  Judge0    │
│ (data)      │ │ (cache/  │ │ (sandboxed │
│             │ │  session)│ │  execution)│
└─────────────┘ └──────────┘ └────────────┘
```

### Data Flow

1. Student writes code → clicks "Run" or "Visualize Step-by-Step".
2. Backend sends code to Judge0 sandbox → receives stdout + execution trace.
3. Trace generator normalizes output into the canonical trace schema.
4. Frontend stepper consumes trace frames and renders Code / Stack / Heap / Output panes.
5. (Optional) Memory animation layer maps trace frames to visual primitives.
6. AI analyzes output/trace → provides age-appropriate feedback + updates mastery score.
7. If mastery threshold met → unlock next concept + celebrate (style depends on age mode).

---

## 4. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 18 + Vite + TypeScript, Tailwind CSS + shadcn/ui, Framer Motion | Fast HMR, component library already scaffolded, animation support |
| **Editor** | Monaco Editor | VS Code-grade editing, syntax highlighting, autocomplete |
| **Animations** | PixiJS (2D sprites, Fun mode) + Three.js (3D, Pro mode) | Already in dependencies; performant on tablets |
| **Backend** | Node.js + Fastify + TypeScript | Schema-based validation, fast, same language as frontend |
| **Database** | PostgreSQL (relational data) + Redis (sessions, cache, job queues) | Full control, Docker Compose for local dev |
| **Auth** | JWT (access + refresh tokens), email + password + role | Simple, stateless, well-understood |
| **Execution** | Self-hosted Judge0 (primary), OneCompiler API (SaaS fallback) | Open-source, 90+ languages, Docker sandboxing, webhook support |
| **AI / LLM** | Pluggable proxy — OpenAI (default), Anthropic, or local Llama | Configurable per deployment; prompt templates include `{age}` and `{mode}` |
| **Dev Infra** | Docker Compose (app, API, Postgres, Redis, Judge0, LLM proxy) | Single `docker compose up` for full local stack |

---

## 5. Core Features

### A. Adaptive Curriculum & Progression

- Pre-built knowledge graph: 50+ micro-lessons (e.g., "Variables & Boxes", "For Loops Adventure").
- Concepts: variables → conditionals → loops → functions → lists → recursion → OOP basics.
- AI pre-assessment quiz at the start of a session.
- After each exercise: 3–5 test cases + LLM rubric evaluation.
- Mastery threshold (≥ 0.80) + transfer check before unlocking the next concept.
- Dashboard: progress world map (Fun) or clean tree (Pro).

### B. Code Editor & Execution

- Monaco editor with syntax highlighting, autocomplete, and age-appropriate themes.
- **Fun**: "Light Bright" or "Neon Kid" theme, big colorful "Let's Go!" button, mascot in corner.
- **Pro**: "Dark Modern" (VS Code Dark+), minimap, line numbers, sleek "Execute" button with keyboard shortcut hints.
- "Run" → instant output panel. "Visualize" → triggers trace mode.
- Input box for stdin (Fun: "What should the dragon say?"; Pro: "Enter stdin").
- Languages: Python first, then JavaScript.

### C. AI Tutor Sidebar

- Context-aware chat: knows the current code, trace, and lesson context.
- "Why is my loop stuck?" → grounded explanation using the actual trace.
- Tone adapts to age mode:
  - Fun: "Awesome job! Your loop just high-fived itself!"
  - Pro: "Correct. The loop terminated because the condition evaluated to false."
- All AI output filtered for age-appropriateness.
- Parent/teacher mode: view full chat history.

### D. Gamification & Accessibility

- Points, streaks, collectible "code artifacts" (Fun/Balanced modes).
- Color-blind modes, large text, keyboard navigation, screen-reader labels.
- Voice narration option (browser TTS).

---

## 6. Visual Code Stepper (Primary Feature)

The stepper is the **most important feature**. It visually steps through code line-by-line, showing the call stack, heap objects, variable changes, and printed output. Modeled after [Python Tutor](https://pythontutor.com).

### Trace Capture

- Instrumented execution emits an ordered list of trace frames.
- Each frame records: executed line, event type, stack frames with locals, heap snapshot, stdout/stderr.
- Trace schema is version-controlled and extensible (see [Section 12](#12-trace-schema)).

### Renderer Components

| Component | Description |
|-----------|-------------|
| **Code Pane** | Source code with current-line highlight and clickable breakpoints |
| **Stack Pane** | Active call frames with local variable values; recursion visible as stacked frames |
| **Heap Pane** | Objects and references rendered as a graph (boxes + pointer arrows) |
| **Output Pane** | stdout/stderr accumulated through execution |
| **Stepper Controls** | Play, pause, step forward/backward, speed slider, jump-to-step scrubber |

### Interactive Features

- Click a variable → see its value history across all steps.
- Click a code line → set/remove a breakpoint.
- "Explain this step" button → LLM generates an age-appropriate explanation of the current line and state.

### Adaptive Visual Skins

| Mode | Stepper Style |
|------|---------------|
| **Fun** | Cartoon arrow on active line, variables as colored bubbles, mascot reactions, stack frames as a ladder with climbing characters |
| **Balanced** | Clean arrows + optional friendly icons |
| **Pro** | Python Tutor / Chrome DevTools style, memory addresses (0x7ffee123), expandable call stack tree, subtle glow on active line, "Show raw memory hex dump" toggle |

---

## 7. Memory Animation (Bonus Feature)

An optional visual layer that maps trace data to animated scenes showing what's happening inside the computer's memory.

### Fun Mode — "Memory City"

- RAM = colorful pixel city grid.
- Variables = dancing characters jumping into houses.
- Assignments = fireworks or treasure drops.
- Pointers = glowing bridges or laser beams.
- Lists/arrays = train cars or conveyor belts.
- Heap allocation = new buildings popping up with fireworks.
- AI narrates: "Watch how your loop creates new memory friends!"

### Pro Mode — "Memory Lab"

- Clean grid of memory slots with actual addresses.
- Variables = labeled boxes with values (optional hex).
- Pointers = precise arrows with offset calculations.
- Stack grows downward like a real call stack.
- Allocation = smooth rectangle expansion with fade.
- Optional 3D fly-through of "inside the RAM chip" (Three.js).
- Toggle: "Show real x86-style memory layout."

### Design Principles

- **Mapping rules**: configurable per age profile (e.g., object → crate, pointer → rope).
- **Toggle**: always visible — "Switch to [Other Mode]" or "Make it more realistic / more fun."
- **Performance**: simplified animations for long traces (sampling or grouping steps).
- **Pedagogical controls**: teachers/parents can toggle abstraction level (hide pointers, show simplified values).

---

## 8. Adaptive UI Engine

A React Context + Tailwind theme system that switches the entire UI instantly.

```
Adaptive UI Engine (React Context + localStorage + cloud sync)
├── Age/Profile Settings
├── Theme Switcher (Fun / Balanced / Pro)
└── Component Variants (e.g., <MemoryVisualizer mode={userMode}>)
```

### Customization Options (Profile Page)

| Setting | Options |
|---------|---------|
| Age group preset | Auto-applies theme |
| Show mascot | On / Off |
| Confetti & celebrations | On / Off |
| Memory style | City / Lab / Auto |
| Color palette | 10 kid-safe + 5 pro palettes |
| Sound effects volume | Slider |
| Animation speed | Slider |

- Profile page locked behind parent PIN for under-13s.
- Global "Theme" button in header for instant switch.
- Preferences saved per device + cloud sync.

---

## 9. AI Integration

### Roles

| Role | Description |
|------|-------------|
| **Hint generation** | Kid-friendly hints grounded in the current trace/code |
| **Step explanation** | On-demand explanation of the current visualizer step |
| **Auto-grading** | Evaluate free-form answers using LLM rubric |
| **Content authoring** | Convert teacher content into micro-lessons and quizzes |
| **Remediation** | Generate targeted micro-lessons when mastery isn't reached |

### Prompt Engineering

- Every prompt includes `{userAge}`, `{mode}`, and `{conceptTag}` for tone/difficulty calibration.
- Fun: "Imagine your variable is a treasure chest!"
- Pro: "The variable `x` is assigned the integer value 42 on the stack."

### Safety & Guardrails

- Moderation layer filters all LLM outputs for age-appropriateness.
- LLM never produces full solutions unless in explicit "show solution" mode.
- All LLM responses logged for audit and improvement.
- Rate-limited per user to control costs.

### Cost Optimization

- Cache/pregenerate static explanations for common trace patterns.
- Use smaller models (e.g., GPT-4o-mini) for simple hints; reserve larger models for complex explanations.

---

## 10. Adaptive Learning & Mastery

### Mastery Model

Per-concept tracking using **Bayesian Knowledge Tracing (BKT)**:

| Signal | Weight |
|--------|--------|
| Test case pass rate | High |
| Hint usage frequency | Medium (inverse) |
| Time to solve | Low |
| Trace analysis (used intended construct?) | Medium |
| Step-level errors | Medium |

- Mastery score: 0.0 – 1.0 per concept tag.
- **Progression threshold**: ≥ 0.80 + a transfer check (apply concept in a slightly different context).

### Assessment Design

- Micro-tasks exercising a single concept.
- Auto-grade via test cases + trace analysis.
- LLM for grading open-ended explanations.

### Remediation

When mastery isn't reached:

1. Targeted micro-lessons selected by the adaptive engine.
2. Visual walkthroughs replaying the trace with AI narration.
3. Scaffolded hints (increasing specificity) generated by the LLM.
4. Spaced practice scheduling for concepts that need reinforcement.

### Personalization

- Difficulty and hint frequency adapt to age and performance.
- More scaffolding for younger kids; less hand-holding for teens.

---

## 11. API Contract

### Global Rules

- **Base path**: `/api/v1`
- **Timestamps**: ISO 8601 UTC strings.
- **Request tracing**: Accept `X-Request-Id` header; echo in all responses.
- **Schema versioning**: `meta.schemaVersion` in every response.

### Response Envelope (Success)

```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid-v4",
  "data": {},
  "meta": { "schemaVersion": "1.0" }
}
```

### Response Envelope (Error)

```json
{
  "status": "error",
  "code": 400,
  "requestId": "uuid-v4",
  "error": {
    "type": "ValidationError",
    "message": "Human-readable message",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```

### Pagination

Cursor-based:

```json
"meta": { "cursor": "opaque-string", "limit": 20, "hasMore": true }
```

### Endpoints

#### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | `{email, password, role, age}` → JWT + user |
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/auth/refresh` | Refresh token flow |

#### Users & Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/:id` | User profile with ageProfile, preferences, masteryMap |
| PATCH | `/users/:id` | Update preferences and UI theme |

#### Curriculum & Concepts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/concepts` | List concepts with tags, prerequisites, difficulty |
| GET | `/concepts/:id` | Detail, canonical examples, recommended exercises |

#### Lessons & Exercises

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lessons/:id` | Lesson content, examples, media, LLM prompt templates |
| GET | `/exercises/:id` | Exercise metadata, test cases, expected trace patterns |
| POST | `/exercises/:id/submit` | `{code, language, options}` → execution job ID + static checks |

#### Execution & Tracing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/execution/run` | `{code, language, stdin, timeoutMs, captureTrace}` → `{jobId, status, estimatedMs}` |
| GET | `/execution/jobs/:jobId` | Job status and final result |
| GET | `/execution/jobs/:jobId/trace` | Full trace object |
| WS | `/execution/jobs/:jobId/stream` | Real-time trace events for stepper playback |

#### Visualizer Helpers

| Method | Path | Description |
|--------|------|-------------|
| POST | `/visualizer/transform` | Raw trace → optimized frames (grouped/diffed) |
| POST | `/visualizer/explain` | `{traceStep, ageProfile, tone}` → LLM explanation |

#### Mastery & Progression

| Method | Path | Description |
|--------|------|-------------|
| GET | `/progress/:userId` | Mastery map per concept, recent attempts |
| POST | `/progress/:userId/update` | Update mastery after an attempt (server computes new BKT score) |

#### Admin & Teacher

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics` | Aggregated metrics (mastery gains, common errors) |
| POST | `/admin/seed` | Seed mock curriculum and users (dev only) |

---

## 12. Trace Schema

A deterministic, versioned format consumed by the visualizer.

```json
{
  "traceVersion": "1.0",
  "jobId": "job-uuid",
  "language": "python",
  "frames": [
    {
      "step": 1,
      "timeMs": 12,
      "file": "main.py",
      "line": 3,
      "event": "line",
      "stack": [
        {
          "frameId": "f1",
          "name": "main",
          "locals": { "i": 0, "arr": ["ref:o1"] }
        }
      ],
      "heap": [
        { "id": "o1", "type": "list", "value": [1, 2], "repr": "[1, 2]" }
      ],
      "stdout": "",
      "stderr": ""
    }
  ],
  "metadata": {
    "durationMs": 120,
    "maxMemoryKb": 5120,
    "totalSteps": 42
  }
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `line` | A line of code is about to execute |
| `call` | Function call (new stack frame) |
| `return` | Function return (frame popped) |
| `exception` | An exception was raised |
| `assign` | Variable assignment |
| `io` | stdin/stdout/stderr operation |

### Design Notes

- Frames use **diffs** where possible to minimize payload size.
- Heap objects have **stable IDs** across frames for pointer tracking.
- Schema is extensible — additional visual layers (memory animation) consume the same trace without changes to the execution engine.

---

## 13. Data Model

### Core Entities

| Entity | Key Fields |
|--------|------------|
| **User** | id, email, role, age, ageProfile, preferences (theme, sound, animations), masteryMap |
| **Concept** | id, name, tags[], prerequisites[], difficulty, description |
| **Lesson** | id, conceptId, content (markdown), examples[], exercises[], media[], llmPromptTemplates |
| **Exercise** | id, lessonId, conceptTags[], testCases[], expectedTracePatterns, rubric, difficulty |
| **Trace** | id, jobId, language, frames[], metadata |
| **Session** | id, userId, exerciseId, attempts[], timestamps, hintsUsed, llmInteractions[], masteryDelta |
| **MasteryRecord** | userId, conceptId, score (0–1), attempts, lastAttemptAt, history[] |

---

## 14. Security, Privacy & Compliance

### Sandboxing

- All student code executes in isolated Docker containers via Judge0.
- Strict CPU / memory / time limits per execution.
- No outbound network access from student code.
- No filesystem persistence between executions.

### Privacy (COPPA / GDPR)

- Parental email verification + consent required for under-13 accounts.
- Data minimization: store only progress data; no long-term chat log retention.
- No marketing tracking.
- Right to deletion; data export on request.

### Application Security

- JWT with short-lived access tokens + refresh token rotation.
- Role-based access control (student, teacher, parent, admin).
- Rate limiting on all endpoints (especially execution and LLM).
- Content moderation on user-submitted code and LLM outputs.
- Input validation via Fastify schemas (Zod or JSON Schema).

---

## 15. Implementation Roadmap

### Phase 1 — MVP (7–9 weeks)

| Week | Deliverable |
|------|-------------|
| 1–2 | Project scaffolding: Vite + TypeScript migration, Fastify API skeleton, Docker Compose (Postgres, Redis, Judge0), JWT auth |
| 3–4 | Monaco editor integration, Judge0 execution pipeline, basic trace generator (Python) |
| 5–6 | **Visual stepper** — Code/Stack/Heap/Output panes, stepper controls, step forward/backward |
| 7 | Adaptive UI Engine — Fun/Balanced/Pro themes, age selector, theme switcher |
| 8–9 | 5 sample lessons (variables, conditionals, loops), mastery quizzes, basic progress tracking |

### Phase 2 — AI & Adaptive (4–6 weeks)

| Week | Deliverable |
|------|-------------|
| 10–11 | LLM proxy integration, "Explain this step" endpoint, AI tutor sidebar |
| 12–13 | BKT mastery scoring, adaptive difficulty, remediation flows |
| 14–15 | Teacher/parent dashboard, analytics endpoint |

### Phase 3 — Polish & Expansion (4 weeks)

| Week | Deliverable |
|------|-------------|
| 16 | Memory animation prototype (Fun: Memory City, Pro: Memory Lab) |
| 17 | JavaScript language support, additional lessons |
| 18 | Accessibility audit, performance optimization, mobile testing |
| 19 | Beta with 10–20 families, iterate |

### Cost Estimate

- **MVP hosting**: < $200/month (Judge0 self-hosted, Postgres, Redis, LLM API credits).
- **LLM costs**: Major recurring expense; mitigated by caching common explanations.

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Inaccurate traces | Validate trace generator against known examples; unit test against Python Tutor output |
| LLM hallucinations | Ground prompts with execution trace + predefined templates; human review for curriculum |
| Sandbox escape | Judge0 + strict resource limits; no network; regular security audits |
| Browser performance (animations) | Lazy-load heavy visualizations; sample/group steps for long traces |
| Maintaining two+ visual styles | Shared trace data layer; React components accept `mode` prop; CSS variables for themes |
| Teens perceiving platform as "for kids" | Pro mode completely hides gamification; optional "Hide all animations" |
| Over-animation distraction | All animations optional and speed-adjustable per user |
| Cost of execution + LLM | Cache common traces; pregenerate static explanations; use small models for simple hints |

---

## 17. Success Metrics

### Learning

| Metric | Target |
|--------|--------|
| Mastery gain per concept | Measurable improvement over ≥ 3 sessions |
| Time to mastery | Decreasing trend per concept |
| Transfer success rate | ≥ 70% on first attempt at transfer tasks |

### Engagement

| Metric | Target |
|--------|--------|
| Session length | ≥ 15 min average |
| Stepper usage rate | ≥ 80% of sessions use the visualizer |
| Return rate (weekly) | ≥ 60% |

### Quality

| Metric | Target |
|--------|--------|
| Trace fidelity | 100% match with known Python Tutor outputs |
| LLM explanation helpfulness | ≥ 4/5 human rating |
| MVP user satisfaction | 80% of kids say "the stepping part helped me understand" |

### A/B Experiments (Post-MVP)

- Animation vs. literal mode effectiveness.
- Hint timing strategies.
- Mastery threshold tuning (0.75 vs 0.80 vs 0.85).
