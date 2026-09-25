import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { runStructured } from "../providers/gemini.js";
import {
  AnalystBreakdownSchema,
  FinalResultSchema,
  ProducerOutputSchema,
  ResearchFindingsSchema,
  ReviewResultSchema,
  SPVBriefSchema,
  type HistoryEntry,
  type StudioState,
} from "../schemas/protocol.js";
import { PROMPTS } from "../agents/prompts.js";

const GraphState = Annotation.Root({
  state: Annotation<StudioState>(),
});

function now(): string {
  return new Date().toISOString();
}

function record(
  step: string,
  actor: string,
  action: string,
  result: string,
): HistoryEntry {
  return {
    step,
    actor,
    action,
    timestamp: now(),
    result,
  };
}

function patch(
  state: StudioState,
  updates: Partial<StudioState>,
  historyEntry: HistoryEntry,
): { state: StudioState } {
  return {
    state: {
      ...state,
      ...updates,
      history: [...state.history, historyEntry],
    },
  };
}

async function spvIntake(input: { state: StudioState }) {
  const state = input.state;
  const brief = await runStructured(
    "SPV_INTAKE",
    PROMPTS.spvIntake,
    state.original_request,
    SPVBriefSchema,
  );

  return patch(
    state,
    {
      goal: brief.goal,
      constraints: brief.constraints,
      success_criteria: brief.success_criteria,
      priority: brief.priority,
      status: "IN_PROGRESS",
    },
    record(
      "SPV_INTAKE",
      "SPV",
      "Membuat brief kerja.",
      "Brief siap.",
    ),
  );
}

async function analyst(input: { state: StudioState }) {
  const state = input.state;
  const payload = JSON.stringify({
    goal: state.goal,
    constraints: state.constraints,
    success_criteria: state.success_criteria,
    priority: state.priority,
    review_issues: state.issues,
  });

  const result = await runStructured(
    "ANALYST",
    PROMPTS.analyst,
    payload,
    AnalystBreakdownSchema,
  );

  return patch(
    state,
    {
      problem_breakdown: result.problem_breakdown,
      questions_to_answer: result.questions_to_answer,
      assumptions: result.assumptions,
      status: "IN_PROGRESS",
      verdict: null,
      revision_target: null,
      issues: [],
    },
    record(
      "ANALYST",
      "WORKER 1",
      "Membuat breakdown dan pertanyaan riset.",
      result.questions_to_answer.length +
        " pertanyaan untuk researcher.",
    ),
  );
}

async function researcher(input: { state: StudioState }) {
  const state = input.state;
  const payload = JSON.stringify({
    problem_breakdown: state.problem_breakdown,
    questions_to_answer: state.questions_to_answer,
    assumptions: state.assumptions,
    review_issues: state.issues,
  });

  const result = await runStructured(
    "RESEARCHER",
    PROMPTS.researcher,
    payload,
    ResearchFindingsSchema,
    { webSearch: true },
  );

  return patch(
    state,
    {
      findings: result.findings,
      unresolved: result.unresolved,
      status: "IN_PROGRESS",
    },
    record(
      "RESEARCHER",
      "WORKER 2",
      "Mengumpulkan informasi dan sumber.",
      result.findings.length +
        " findings; " +
        result.unresolved.length +
        " unresolved.",
    ),
  );
}

async function producer(input: { state: StudioState }) {
  const state = input.state;
  const payload = JSON.stringify({
    original_request: state.original_request,
    goal: state.goal,
    constraints: state.constraints,
    success_criteria: state.success_criteria,
    findings: state.findings,
    unresolved: state.unresolved,
    review_issues: state.issues,
  });

  const result = await runStructured(
    "PRODUCER",
    PROMPTS.producer,
    payload,
    ProducerOutputSchema,
  );

  return patch(
    state,
    {
      draft_output: result.draft_output,
      used_findings: result.used_findings,
      gaps_acknowledged: result.gaps_acknowledged,
      status: "IN_PROGRESS",
    },
    record(
      "PRODUCER",
      "WORKER 3",
      "Menggabungkan findings menjadi draft output.",
      "Draft output selesai.",
    ),
  );
}

async function reviewer(input: { state: StudioState }) {
  const state = input.state;
  const payload = JSON.stringify({
    draft_output: state.draft_output,
    used_findings: state.used_findings,
    gaps_acknowledged: state.gaps_acknowledged,
    success_criteria: state.success_criteria,
  });

  const result = await runStructured(
    "REVIEWER",
    PROMPTS.reviewer,
    payload,
    ReviewResultSchema,
  );

  return patch(
    state,
    {
      verdict: result.verdict,
      issues: result.issues,
      revision_target: result.revision_target,
      status:
        result.verdict === "PASS"
          ? "DONE"
          : result.verdict === "NEEDS_REVISION"
            ? "NEEDS_REVISION"
            : "REJECTED",
    },
    record(
      "ANALYST_REVIEW",
      "WORKER 1",
      "Menilai hasil Producer.",
      result.verdict + "; target=" + result.revision_target + ".",
    ),
  );
}

async function spvFinal(input: { state: StudioState }) {
  const state = input.state;

  if (state.verdict !== "PASS") {
    const message =
      state.verdict === "FAIL"
        ? "Hasil belum dapat diselesaikan secara aman karena reviewer menandai task sebagai FAIL."
        : "Hasil belum memenuhi kriteria setelah batas revisi tercapai.";

    const flags = [
      ...state.issues,
      ...state.unresolved,
      ...state.gaps_acknowledged,
    ].filter((value, index, all) => value && all.indexOf(value) === index);

    return patch(
      state,
      {
        final_output: message,
        summary_of_process:
          "SPV menghentikan finalisasi karena hasil belum lolos review.",
        flags_for_user:
          flags.length > 0 ? flags : ["Perlu intervensi atau revisi manual."],
        status: "BLOCKED",
      },
      record(
        "SPV_FINAL",
        "SPV",
        "Menghentikan finalisasi dan melakukan eskalasi.",
        "Task belum layak dikirim sebagai hasil final.",
      ),
    );
  }

  const payload = JSON.stringify({
    original_request: state.original_request,
    success_criteria: state.success_criteria,
    verdict: state.verdict,
    issues: state.issues,
    draft_output: state.draft_output,
    unresolved: state.unresolved,
    gaps_acknowledged: state.gaps_acknowledged,
    history: state.history,
  });

  const result = await runStructured(
    "SPV_FINAL",
    PROMPTS.spvFinal,
    payload,
    FinalResultSchema,
  );

  return patch(
    state,
    {
      final_output: result.final_output,
      summary_of_process: result.summary_of_process,
      flags_for_user: result.flags_for_user,
      status: "DONE",
    },
    record(
      "SPV_FINAL",
      "SPV",
      "Melakukan final check dan menyiapkan hasil.",
      "Hasil siap dikirim ke user.",
    ),
  );
}

function afterReview(state: StudioState): string {
  if (state.verdict === "PASS" || state.verdict === "FAIL") {
    return "spv_final";
  }

  if (state.revision_count >= 2) {
    return "spv_final";
  }

  if (state.revision_target === "ANALYST") {
    return "analyst_revision";
  }

  if (state.revision_target === "RESEARCHER") {
    return "researcher_revision";
  }

  return "producer_revision";
}

async function revisionCounter(input: { state: StudioState }) {
  const state = input.state;
  const nextCount = state.revision_count + 1;

  return patch(
    state,
    {
      revision_count: nextCount,
    },
    record(
      "REVISION_ROUTE",
      "SYSTEM",
      "Mengirim task kembali ke target revisi.",
      "Revision #" + nextCount + ".",
    ),
  );
}

export function buildStudioGraph() {
  const workflow = new StateGraph(GraphState)
    .addNode("spv_intake", spvIntake)
    .addNode("analyst", analyst)
    .addNode("researcher", researcher)
    .addNode("producer", producer)
    .addNode("reviewer", reviewer)
    .addNode("revision_counter", revisionCounter)
    .addNode("analyst_revision", analyst)
    .addNode("researcher_revision", researcher)
    .addNode("producer_revision", producer)
    .addNode("spv_final", spvFinal)
    .addEdge(START, "spv_intake")
    .addEdge("spv_intake", "analyst")
    .addEdge("analyst", "researcher")
    .addEdge("researcher", "producer")
    .addEdge("producer", "reviewer")
    .addEdge("reviewer", "revision_counter")
    .addConditionalEdges(
      "revision_counter",
      (state) => afterReview(state.state),
      [
        "spv_final",
        "analyst_revision",
        "researcher_revision",
        "producer_revision",
      ],
    )
    .addEdge("analyst_revision", "researcher")
    .addEdge("researcher_revision", "producer")
    .addEdge("producer_revision", "reviewer")
    .addEdge("spv_final", END);

  return workflow.compile();
}

export type StudioGraph = ReturnType<typeof buildStudioGraph>;
