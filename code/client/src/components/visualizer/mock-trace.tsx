export const MOCK_TRACE = {
  traceVersion: "1.0",
  jobId: "job-mock-001",
  language: "python",
  frames: [
    {
      step: 1, timeMs: 0, file: "main.py", line: 1, event: "call",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [64, 34, 25, 12, 22], n: 5 } }],
      heap: [{ id: "o1", type: "list", repr: "[64, 34, 25, 12, 22]", items: [64, 34, 25, 12, 22] }],
      stdout: "", stderr: ""
    },
    {
      step: 2, timeMs: 5, file: "main.py", line: 3, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [64, 34, 25, 12, 22], n: 5, i: 0 } }],
      heap: [{ id: "o1", type: "list", repr: "[64, 34, 25, 12, 22]", items: [64, 34, 25, 12, 22] }],
      stdout: "", stderr: ""
    },
    {
      step: 3, timeMs: 10, file: "main.py", line: 4, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [64, 34, 25, 12, 22], n: 5, i: 0, j: 0 } }],
      heap: [{ id: "o1", type: "list", repr: "[64, 34, 25, 12, 22]", items: [64, 34, 25, 12, 22] }],
      stdout: "", stderr: ""
    },
    {
      step: 4, timeMs: 14, file: "main.py", line: 5, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [64, 34, 25, 12, 22], n: 5, i: 0, j: 0 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 64, 25, 12, 22]", items: [34, 64, 25, 12, 22] }],
      stdout: "Comparing 64 and 34 → swapping\n", stderr: ""
    },
    {
      step: 5, timeMs: 19, file: "main.py", line: 4, event: "assign",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [34, 64, 25, 12, 22], n: 5, i: 0, j: 1 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 64, 25, 12, 22]", items: [34, 64, 25, 12, 22] }],
      stdout: "Comparing 64 and 34 → swapping\n", stderr: ""
    },
    {
      step: 6, timeMs: 24, file: "main.py", line: 5, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [34, 25, 64, 12, 22], n: 5, i: 0, j: 1 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 25, 64, 12, 22]", items: [34, 25, 64, 12, 22] }],
      stdout: "Comparing 64 and 34 → swapping\nComparing 64 and 25 → swapping\n", stderr: ""
    },
    {
      step: 7, timeMs: 29, file: "main.py", line: 4, event: "assign",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [34, 25, 12, 64, 22], n: 5, i: 0, j: 2 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 25, 12, 64, 22]", items: [34, 25, 12, 64, 22] }],
      stdout: "Comparing 64 and 34 → swapping\nComparing 64 and 25 → swapping\nComparing 64 and 12 → swapping\n", stderr: ""
    },
    {
      step: 8, timeMs: 35, file: "main.py", line: 5, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [34, 25, 12, 22, 64], n: 5, i: 0, j: 3 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 25, 12, 22, 64]", items: [34, 25, 12, 22, 64] }],
      stdout: "Comparing 64 and 34 → swapping\nComparing 64 and 25 → swapping\nComparing 64 and 12 → swapping\nComparing 64 and 22 → swapping\n", stderr: ""
    },
    {
      step: 9, timeMs: 40, file: "main.py", line: 3, event: "line",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [34, 25, 12, 22, 64], n: 5, i: 1 } }],
      heap: [{ id: "o1", type: "list", repr: "[34, 25, 12, 22, 64]", items: [34, 25, 12, 22, 64] }],
      stdout: "Comparing 64 and 34 → swapping\nComparing 64 and 25 → swapping\nComparing 64 and 12 → swapping\nComparing 64 and 22 → swapping\nPass 1 done.\n", stderr: ""
    },
    {
      step: 10, timeMs: 55, file: "main.py", line: 6, event: "return",
      stack: [{ frameId: "f1", name: "bubble_sort", locals: { arr: [12, 22, 25, 34, 64], n: 5, i: 4 } }],
      heap: [{ id: "o1", type: "list", repr: "[12, 22, 25, 34, 64]", items: [12, 22, 25, 34, 64] }],
      stdout: "Comparing 64 and 34 → swapping\nComparing 64 and 25 → swapping\nComparing 64 and 12 → swapping\nComparing 64 and 22 → swapping\nPass 1 done.\nSorted: [12, 22, 25, 34, 64]\n", stderr: ""
    },
  ],
  metadata: { durationMs: 55, maxMemoryKb: 1024 }
};