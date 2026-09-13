# North Creek High School AI Assistant ("The Bell")

An intelligent school and district handbook guide that answers student and parent questions regarding counselor assignments, bell schedules, attendance reporting, and school policies.

## Run & Operate

* `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
* `pnpm run typecheck` — full typecheck across all packages
* `pnpm run build` — typecheck + build all packages
* `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
* `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
* Required env: `DATABASE_URL` — Postgres connection string, `GROQ_API_KEY` — Groq API key for Llama 3.1 LLM completions

## Stack

* pnpm workspaces, Node.js 24, TypeScript 5.9
* Frontend: React, Vite, Wouter (routing), Lucide icons
* API: Express 5
* AI / LLM: Groq API (`llama-3.1-8b-instant`)
* DB: PostgreSQL + Drizzle ORM
* Validation: Zod (`zod/v4`), `drizzle-zod`
* API codegen: Orval (from OpenAPI spec)
* Build: esbuild (CJS bundle)

## Where things live

* **Chat Interface Frontend**: `artifacts/ui/src/pages/chat.tsx`
* **Backend Chat API Route**: `artifacts/api-server/src/routes/index.ts`
* **Database Schema**: `artifacts/db/src/schema.ts`

## Architecture decisions

* **Server-Side API Route**: Routed LLM requests through the Express backend to secure the `GROQ_API_KEY` and prevent client-side token exposure.
* **System Prompt Guardrails**: Injected structured North Creek High School counselor and schedule details directly into the system prompt to maintain deterministic, accurate fallback answers.
* **Plain Text Fallback Routing**: Integrated keyword matching logic to handle inquiries locally when API connectivity is disrupted.

## Product

* Interactive chat widget ("The Bell") providing instantaneous responses regarding student services.
* Dynamic alphabetical counselor matching (A-Z split by last name with contact emails/phones).
* Direct access to attendance reporting guidelines and school calendar hours.

## User preferences

* Use plain text without markdown asterisks for assistant output to match clean conversational UI styles.

## Gotchas

* Ensure `GROQ_API_KEY` is added to your environment variables file (`.env`) or server secrets before starting the backend server.
* Restart the Express API server whenever updates are made to `artifacts/api-server/src/routes/index.ts`.

## Pointers

* See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.