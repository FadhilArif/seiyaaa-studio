import * as z from "zod";

export const StatusSchema = z.enum([
  "IN_PROGRESS",
  "DONE",
  "NEEDS_REVISION",
  "BLOCKED",
  "REJECTED",
]);

export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(["normal", "urgent"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const HistoryEntrySchema = z.object({
  step: z.string(),
  actor: z.string(),
  action: z.string(),
  timestamp: z.string(),
  result: z.string(),
});

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const SPVBriefSchema = z.object({
  goal: z.string(),
  constraints: z.array(z.string()),
  success_criteria: z.string(),
  priority: PrioritySchema,
});

export type SPVBrief = z.infer<typeof SPVBriefSchema>;

export const AnalystBreakdownSchema = z.object({
  problem_breakdown: z.array(z.string()),
  questions_to_answer: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type AnalystBreakdown = z.infer<typeof AnalystBreakdownSchema>;

export const FindingSchema = z.object({
  question: z.string(),
  answer: z.string(),
  source: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const ResearchFindingsSchema = z.object({
  findings: z.array(FindingSchema),
  unresolved: z.array(z.string()),
});

export type ResearchFindings = z.infer<typeof ResearchFindingsSchema>;

export const ProducerOutputSchema = z.object({
  draft_output: z.string(),
  used_findings: z.array(z.string()),
  gaps_acknowledged: z.array(z.string()),
});

export type ProducerOutput = z.infer<typeof ProducerOutputSchema>;

export const ReviewResultSchema = z.object({
  verdict: z.enum(["PASS", "NEEDS_REVISION", "FAIL"]),
  issues: z.array(z.string()),
  revision_target: z.enum(["PRODUCER", "RESEARCHER", "ANALYST"]),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const FinalResultSchema = z.object({
  final_output: z.string(),
  summary_of_process: z.string(),
  flags_for_user: z.array(z.string()),
});

export type FinalResult = z.infer<typeof FinalResultSchema>;

export const StudioStateSchema = z.object({
  task_id: z.string(),
  original_request: z.string(),
  status: StatusSchema,
  history: z.array(HistoryEntrySchema),
  goal: z.string().default(""),
  constraints: z.array(z.string()).default([]),
  success_criteria: z.string().default(""),
  priority: PrioritySchema.default("normal"),
  problem_breakdown: z.array(z.string()).default([]),
  questions_to_answer: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  findings: z.array(FindingSchema).default([]),
  unresolved: z.array(z.string()).default([]),
  draft_output: z.string().default(""),
  used_findings: z.array(z.string()).default([]),
  gaps_acknowledged: z.array(z.string()).default([]),
  verdict: z.enum(["PASS", "NEEDS_REVISION", "FAIL"]).nullable().default(null),
  issues: z.array(z.string()).default([]),
  revision_target: z.enum(["PRODUCER", "RESEARCHER", "ANALYST"]).nullable().default(null),
  revision_count: z.number().int().nonnegative().default(0),
  final_output: z.string().default(""),
  summary_of_process: z.string().default(""),
  flags_for_user: z.array(z.string()).default([]),
});

export type StudioState = z.infer<typeof StudioStateSchema>;
