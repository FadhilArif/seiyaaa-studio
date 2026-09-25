import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const mockMode = (process.env.MOCK_MODE || "true").toLowerCase() === "true";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function ensureLiveMode(): GoogleGenAI {
  if (!ai) {
    throw new Error(
      "GEMINI_API_KEY belum tersedia. Salin .env.example menjadi .env atau gunakan MOCK_MODE=true.",
    );
  }
  return ai;
}

type AgentRole =
  | "SPV_INTAKE"
  | "ANALYST"
  | "RESEARCHER"
  | "PRODUCER"
  | "REVIEWER"
  | "SPV_FINAL";

export async function runStructured<T>(
  role: AgentRole,
  systemInstruction: string,
  input: string,
  schema: z.ZodType<T>,
  options: { webSearch?: boolean } = {},
): Promise<T> {
  if (mockMode) {
    return mockAgent(role, input) as T;
  }

  const client = ensureLiveMode();

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: systemInstruction + "\n\nINPUT:\n" + input }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: z.toJSONSchema(schema, { target: "draft-07" }),
      ...(options.webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error(role + " tidak mengembalikan output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      role +
        " mengembalikan JSON tidak valid: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  return schema.parse(parsed);
}

function mockAgent(role: AgentRole, input: string): unknown {
  switch (role) {
    case "SPV_INTAKE":
      return {
        goal: input.trim(),
        constraints: ["V0.1 mock mode"],
        success_criteria:
          "Menghasilkan jawaban yang langsung menjawab permintaan user.",
        priority: "normal",
      };

    case "ANALYST":
      return {
        problem_breakdown: ["Pahami permintaan: " + input.trim()],
        questions_to_answer: [
          "Informasi apa yang diperlukan untuk memenuhi permintaan: " +
            input.trim(),
        ],
        assumptions: [],
      };

    case "RESEARCHER":
      return {
        findings: [
          {
            question: input.trim(),
            answer:
              "Ini adalah hasil mock. Aktifkan MOCK_MODE=false untuk melakukan riset web nyata.",
            source: "mock://research",
            confidence: "low",
          },
        ],
        unresolved: [],
      };

    case "PRODUCER":
      return {
        draft_output:
          "HASIL MOCK\n\nPermintaan diproses dalam mode simulasi. Aktifkan Gemini API untuk menghasilkan hasil nyata berdasarkan riset.",
        used_findings: ["mock://research"],
        gaps_acknowledged: [
          "Mode simulasi tidak melakukan pencarian web nyata.",
        ],
      };

    case "REVIEWER":
      return {
        verdict: "PASS",
        issues: [],
        revision_target: "PRODUCER",
      };

    case "SPV_FINAL":
      return {
        final_output:
          "Workflow V0.1 berhasil dijalankan dalam MOCK_MODE. Belum ada panggilan Gemini atau web research nyata.",
        summary_of_process:
          "SPV -> Analyst -> Researcher -> Producer -> Review -> SPV.",
        flags_for_user: [
          "Gunakan GEMINI_API_KEY dan MOCK_MODE=false untuk live run.",
        ],
      };
  }
}
