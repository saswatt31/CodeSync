# CodeSync — Real-time Collaborative Code Interview Platform

A production-grade technical interview platform with real-time collaborative editing (Operational Transformation), WebRTC video, live code execution, Gemini AI code review, and full session replay.

## Architecture

```
codesync/
├── server/          Node.js + Express + Socket.io
├── client/          Next.js 15 + Tailwind + Monaco
└── supabase_schema.sql
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, Tailwind CSS, Framer Motion |
| Editor | Monaco Editor (@monaco-editor/react) |
| Realtime | Socket.io with Operational Transformation |
| Video/Audio | WebRTC (browser native + simple-peer) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + JWT (httpOnly cookies) |
| Code Execution | Judge0 CE API |
| AI Review | Google Gemini 2.0 Flash |

## Features

### Collaborative Editor (OT)
Every keystroke is sent as a structured operation (`insert at pos X` / `delete N chars at pos Y`). The server transforms concurrent operations against each other before broadcasting — so two users editing the same line simultaneously never corrupt each other's work. This is the core differentiator from naive "send full content on change" approaches.

### WebRTC Video + Audio
Peer-to-peer video and audio via browser WebRTC APIs, signaled through Socket.io. No Zoom, no Google Meet — built-in.

### Live Code Execution
Judge0 CE API supports 50+ languages. Both participants see the output simultaneously via Socket.io broadcast.

### AI Code Review (Gemini)
Triggered mid-session by either participant. Returns:
- Overall score (1–10) and hire signal
- Time and space complexity with explanation
- Strengths, issues (severity tagged), edge cases missed
- Optional improved snippet

### Private Interviewer Notes
Auto-saved notes panel only visible to the session host. Candidate cannot see it.

### Session Replay
Every operation is stored as an event in Supabase. After a session ends, you can replay the entire coding journey keystroke-by-keystroke with adjustable speed.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Database → SQL Editor**, paste `supabase_schema.sql`, and run it
3. Go to **Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

### 2. Server

```bash
cd server
npm install
cp .env.example .env
# Fill in .env
npm run dev
```

**server/.env**
```env
PORT=5000
CLIENT_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=any-random-secret-string
GEMINI_API_KEY=your-gemini-api-key
JUDGE0_API_KEY=your-judge0-rapidapi-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
```

Get free keys:
- **Gemini**: [aistudio.google.com](https://aistudio.google.com)
- **Judge0**: [rapidapi.com/judge0-official/api/judge0-ce](https://rapidapi.com/judge0-official/api/judge0-ce) (free tier: 50 req/day)

### 3. Client

```bash
cd client
npm install
cp .env.local.example .env.local
npm run dev
```

**client/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Register** → creates account in Supabase Auth + profiles table
2. **Create session** → generates a 6-char invite code
3. **Share invite code** → candidate joins via dashboard "Join session"
4. **Both land in the session** → editor syncs in real-time via OT
5. **Run code** → Judge0 executes it, both see output
6. **AI Review** → Gemini analyzes the code
7. **Host takes notes** → private, auto-saved
8. **End session** → session saved, replay available

## File Map

```
server/
├── index.js                    Entry point
├── middleware/auth.js          JWT protect + socket auth
├── routes/
│   ├── auth.js                 Register, login, logout, /me
│   ├── sessions.js             CRUD, join, events, notes
│   ├── execute.js              Judge0 code execution
│   └── ai.js                   Gemini code review
├── services/supabase.js        Supabase client
└── socket/index.js             OT + real-time events

client/src/
├── app/
│   ├── layout.jsx              Root layout
│   ├── page.jsx                Landing page
│   ├── auth/
│   │   ├── login/page.jsx
│   │   └── register/page.jsx
│   ├── dashboard/page.jsx      Session list + create/join
│   └── session/[id]/
│       ├── page.jsx            Main session (editor + panels)
│       └── replay/page.jsx     Session replay
├── context/AuthContext.jsx     Global auth state
└── lib/
    ├── api.js                  All API calls
    ├── socket.js               Socket.io singleton
    └── utils.js                cn() helper
```

## Deployment

| Service | Platform |
|---|---|
| Server | Railway / Render / Fly.io |
| Client | Vercel |
| Database | Supabase (already hosted) |

Update `CLIENT_URL` in server env and `NEXT_PUBLIC_*` in client env to production URLs before deploying.

## What makes this impressive in interviews

| Question | Your answer |
|---|---|
| "How does the collaborative editing work?" | OT: every change is an op, server transforms concurrent ops before broadcasting |
| "Why OT and not CRDTs?" | OT is simpler to implement for linear text; CRDTs (like Yjs) are better for P2P but require more complexity |
| "How do you handle slow connections?" | Client sends `clientVersion`, server transforms against all ops since that version |
| "How is the execution sandboxed?" | Judge0 runs code in isolated containers with CPU/memory limits |
| "What's the replay system?" | Event sourcing: every op stored as an ordered event, replay = re-applying ops from t=0 |
| "How does WebRTC work here?" | Socket.io used for signaling (offer/answer/ICE), then P2P media channel established |
