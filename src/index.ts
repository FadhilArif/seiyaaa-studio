import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { buildStudioGraph } from "./workflow/studioGraph.js";
import type { StudioState } from "./schemas/protocol.js";

async function main() {
  const request = process.argv.slice(2).join(" ").trim();

  if (!request) {
    console.error('Usage: npm run dev -- "permintaan kamu"');
    process.exitCode = 1;
    return;
  }

  const taskId =
    "TASK-" +
    new Date().toISOString().slice(0, 10).replaceAll("-", "") +
    "-" +
    randomUUID().slice(0, 8);

  const initial: StudioState = {
    task_id: taskId,
    original_request: request,
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

  console.log("\n=== SEIYAAA STUDIO V0.1 ===");
  console.log("Task: " + taskId);
  console.log("Request: " + request + "\n");

  const result = await graph.invoke({ state: initial });
  const finalState = result.state as StudioState;

  for (const entry of finalState.history) {
    console.log("[" + entry.step + "] " + entry.result);
  }

  console.log("\n=== FINAL OUTPUT ===\n");
  console.log(finalState.final_output);

  if (finalState.flags_for_user.length > 0) {
    console.log("\n=== FLAGS ===");
    for (const flag of finalState.flags_for_user) {
      console.log("- " + flag);
    }
  }

  await mkdir("data/runs", { recursive: true });
  await writeFile(
    "data/runs/" + taskId + ".json",
    JSON.stringify(finalState, null, 2),
    "utf8",
  );

  console.log("\nRun saved: data/runs/" + taskId + ".json");
}

main().catch((error) => {
  console.error("\nSeiyaaa Studio gagal menjalankan workflow.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
