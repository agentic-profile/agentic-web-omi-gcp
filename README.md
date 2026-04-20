<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Omi + Agentic Web (Google Cloud Run)

This app connects an **Omi** wearable (via webhooks) to an **AI “memory assistant”** and an **Agentic Web** identity. It ingests conversation “memories”, stores the raw device payload in Firestore, generates AI summaries with Gemini, and lets you publish an agent that can participate in agent-to-agent (A2A) conversations.

It is designed to be deployed to **Google Cloud Run** (the Express server serves the API and, in production, the built SPA).

## Features

- **Google sign-in (Firebase Auth)**
  - First login provisions an `accounts` document server-side (`/api/account/ensure`).
- **Connect Omi**
  - Generates a per-user Omi webhook URL (`/omi/api-key`) you paste into the Omi mobile app.
  - Optional “Test Webhook” tool to POST a sample memory payload to your webhook.
- **Omi memories inbox**
  - Firestore-backed list of memories with **search** and **delete**.
  - Shows both **raw JSON** and **AI-generated summary JSON**.
- **Reflection chat (“Memory Assistant”)**
  - Chat endpoint (`/api/chat`) uses your stored memories plus your prompt/instructions to answer questions.
- **Go LIVE on the Agentic Web**
  - Builds a registration payload (`/publish/payload`) and opens a publisher URL to register.
  - Stores your resulting **Agent DID** back onto your account via callback (`/publish/callback`).
  - “Expert mode” exposes the raw registration payload and publisher selection.
- **Agent chats (A2A)**
  - View chats between your agent and peer agents; open details, continue/restart, and delete.
  - Record a simple “Like/Pass” resolution for peers.
- **Prompt & introduction editor**
  - Customize: `introduction`, `chat_instruction`, and `memory_summarize` prompts (stored on your account).
- **Settings**
  - Toggle “Expert Mode” UI.
- **Admin tools (role = `admin`)**
  - Manage users (list accounts, add credits, change role, disable accounts, delete users and associated data).

## Project layout

```
.
├─ server.ts                     # Express entrypoint + Vite dev middleware + static serving in prod
├─ server/
│  ├─ endpoints/                 # Express route registration (chat, publish, admin, etc.)
│  ├─ a2a/                       # Agent-to-agent (A2A lite) routing + chat orchestration
│  ├─ stores/                    # Firestore-backed stores (accounts, agent chats, sessions)
│  ├─ firebase.ts                # Firebase Admin + server-side Firestore initialization
│  └─ utils/                     # auth/http/log helpers
├─ src/
│  ├─ App.tsx                    # Router + navigation + login + account provisioning
│  ├─ pages/                     # UI routes (Connect Omi, Memories, Publish, Admin, etc.)
│  ├─ components/                # UI + shared components (LoginModal, DIDLink, AgentIdentity, ...)
│  ├─ store/                     # Zustand stores (expert mode)
│  └─ firebase.ts                # Firebase client SDK init (Auth + Firestore + emulators)
├─ firebase-applet-config.json   # Firebase client config (checked in for local/dev)
├─ firebase.json                 # Firebase hosting + emulator config (optional)
└─ instruction.md                # Default chat instruction (fallback if user has no custom prompt)
```

## Tech stack

- **Frontend**: React + Vite + Tailwind UI (shadcn-style components)
- **Backend**: Express (single server that runs APIs and serves the SPA)
- **Auth/DB**: Firebase Auth + Firestore (client) and Firebase Admin SDK (server)
- **AI**: Gemini via `@google/genai`
- **Agentic Web / A2A**: `@agentic-profile/*` libraries, served under `/a2a`

## Run locally

### Prereqs

- Node.js
- `pnpm` (this repo declares a `pnpm` package manager in `package.json`)

### Install

```bash
pnpm install
```

### Configure environment

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

- **`GEMINI_API_KEY`**: required for AI chat and summarization
- **`APP_URL`**: the public base URL of the service (used to build webhook/callback URLs). In Cloud Run this is typically the Cloud Run service URL.
- **`IDENTITY_PRIVATE_KEY` / `SYSTEM_PRIVATE_KEY`**: used for DID/Agentic Web signing (required when going LIVE / A2A).

### Start dev server

```bash
pnpm dev
```

This runs `server.ts` (Express) and mounts Vite in middleware mode so the SPA and API share the same origin.

### Firebase emulators (optional)

If you want to run against local Firebase emulators:

```bash
pnpm emulators
```

The client automatically connects to Auth/Firestore emulators when running on `localhost`.

## Deploy to Google Cloud Run

This repo is built to deploy as a **single Cloud Run service** (Express server + static SPA build).

### Deploy the server to Cloud Run

The repository already includes a deploy script:

```bash
pnpm server:deploy
```

This uses `gcloud run deploy ... --source .` (Cloud Build/buildpacks). It also configures required secrets:

- `GEMINI_API_KEY`
- `IDENTITY_PRIVATE_KEY`
- `SYSTEM_PRIVATE_KEY`

### (Optional) Deploy via Firebase Hosting -> Cloud Run

`firebase.json` is configured to rewrite all requests to a Cloud Run service (`serviceId: agentic-web-omi-gcp`). If you want a Firebase Hosting front door:

```bash
pnpm webapp:deploy
```

Or deploy both server and hosting:

```bash
pnpm cloud:deploy
```
