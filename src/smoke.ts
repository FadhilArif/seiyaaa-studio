import "dotenv/config";
process.env.MOCK_MODE = "true";

const { buildStudioGraph } = await import("./workflow/studioGraph.js");
const initial = {
  task_id: "SMOKE-001",
  original_request: "Buat ringkasan singkat tentang fungsi Seiyaaa Studio.",
  status: "IN_PROGRESS",
  history: [],
  goal: "",
  constraints: [],
  success_criteria: "",
  priority: "normal",
  problem_breakdown: [],
  questions_to_answer: [],
  assumptions: [],
  findings: [],
  unresolved: [],
  draft_output: "",
  used_findings: [],
  gaps_acknowledged: [],
  verdict: null,
  issues: [],
  revision_target: null,
  revision_count: 0,
  final_output: "",
  summary_of_process: "",
  flags_for_user: [],
};

const graph = buildStudioGraph();
const result = await graph.invoke({ state: initial });

if (!result?.state?.final_output) {
  throw new Error("Smoke test gagal: final_output kosong.");
}

if (!Array.isArray(result.state.history) || result.state.history.length < 6) {
  throw new Error("Smoke test gagal: history workflow tidak lengkap.");
}

console.log("SMOKE TEST PASS");
console.log("History entries:", result.state.history.length);
