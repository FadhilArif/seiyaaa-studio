# Seiyaaa Studio

V0.1 is the core agent chain for Seiyaaa Studio.

Workflow:

USER -> SPV (Intake) -> ANALYST -> RESEARCHER -> PRODUCER -> ANALYST (Review) -> SPV (Final Check) -> USER

## Current scope

- One task at a time from the CLI.
- LangGraph handles the workflow and revision loop.
- Gemini 3.8 Flash is the default model.
- Researcher uses Gemini Google Search grounding.
- JSON output is validated with Zod.
- MOCK_MODE lets the chain run without an API key.
- No database, persistent memory, web UI, or character UI yet.

## Requirements

- Node.js 22+
- npm

## Setup

1. Copy .env.example to .env.
2. Keep MOCK_MODE=true for a no-cost dry run.
3. Set GEMINI_API_KEY and MOCK_MODE=false for live execution.
4. Install dependencies with npm install.
5. Run smoke test with: npm run smoke
6. Run with: npm run dev -- "permintaan kamu"
7. Build with: npm run build

## Design rule

The original request and accumulated history stay in the workflow state. Agents do not silently replace missing information with guesses.
