# CrustyHelpdesk

A helpdesk ticketing system with built-in Windows Event Log collection via a Rust agent.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, SQLite (Prisma 7), NextAuth v5

## Quick Start (Webapp)

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run build
npx tsx prisma/seed.ts
npm run start
```

Default login: `admin` / `admin`

The app runs at `http://localhost:3000`.

For development:
```bash
npm run dev
```

## Roles

| Role | Access |
|------|--------|
| CLIENT | Create tickets, view/edit own tickets |
| LEVEL_1 | See all L1 tickets, work them, escalate to L2 |
| LEVEL_2 | See L2-escalated/assigned tickets, escalate to L3 |
| LEVEL_3 | See L3-escalated/assigned tickets |
| ADMIN | Full access + user management + agent token management |

## Agent Setup (Windows Event Log Collection)

The Rust agent runs on client machines and collects Windows Event Viewer logs when requested from the webapp. It polls the webapp for pending tasks — no inbound ports are opened on client machines.

### 1. Create an Agent Token

1. Log in as an Admin
2. Go to **Settings > Agent Tokens** (or navigate to `/settings/agents`)
3. Click **Create Token**
4. Enter the machine hostname (must match the machine the agent will run on, e.g. `WORKSTATION-01`)
5. Optionally add a description
6. Click **Create** — copy the token immediately, it is only shown once

The token looks like: `cht_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Build the Agent

Requires [Rust](https://rustup.rs/) with the MSVC toolchain.

```bash
cd agent
cargo build --release
```

The binary is at `agent/target/x86_64-pc-windows-msvc/release/crusty-agent.exe`.

### 3. Configure the Agent

Copy `agent/config.example.toml` to `config.toml` next to the agent executable:

```toml
[server]
url = "https://helpdesk.example.com"   # your webapp URL
api_key = "cht_xxxxxxxxxxxx"            # the token from step 1
poll_interval_secs = 30                 # how often to check for tasks

[agent]
# machine_name = "WORKSTATION-01"       # defaults to system hostname if omitted
```

### 4. Run the Agent

**Console mode** (for testing):
```bash
crusty-agent.exe run
```

**Install as a Windows service** (runs on boot):
```bash
# Run as Administrator
crusty-agent.exe install
net start CrustyAgent
```

**Uninstall the service:**
```bash
net stop CrustyAgent
crusty-agent.exe uninstall
```

### 5. Request Logs from the Webapp

1. Open a ticket that has a **Client Machine** hostname matching an agent's machine name
2. Click **Request Logs** (visible to staff roles only)
3. Select which log types to collect (Application, System, Security, Setup)
4. Click **Submit Request**

The ticket status changes to **AWAITING LOGS**. The page auto-refreshes every 10 seconds. Once the agent picks up the task, collects the logs, and submits them back, the log entries appear in expandable rows on the ticket detail page.

The time range collected is the ticket's issue timeframe +/- 30 minutes.

## Agent API Reference

All agent endpoints require a Bearer token in the Authorization header.

### `GET /api/agent/tasks?machine=HOSTNAME`

Returns pending log requests for the given machine. Atomically marks them as IN_PROGRESS.

### `POST /api/agent/tasks/:id/results`

Submit log collection results.

```json
{
  "status": "COMPLETED",
  "entries": [
    {
      "eventId": 1000,
      "level": "Error",
      "source": "Application Error",
      "message": "Faulting application name: app.exe",
      "timestamp": "2026-03-12T10:30:00.000Z",
      "rawXml": "<Event>...</Event>"
    }
  ]
}
```

Or on failure:
```json
{
  "status": "FAILED",
  "errorMessage": "Access denied to Security log",
  "entries": []
}
```

Entry limit: 10,000 per submission.

### `GET /api/agent/tokens` (Admin session required)

List all agent tokens (no plaintext).

### `POST /api/agent/tokens` (Admin session required)

Create a new agent token. Returns the plaintext token once.

```json
{
  "machineName": "WORKSTATION-01",
  "description": "Engineering lab workstation"
}
```

### `DELETE /api/agent/tokens?id=TOKEN_ID` (Admin session required)

Revoke an agent token.

## Security

- **No listening ports** — the agent only makes outbound HTTP calls
- **Per-machine API keys** — bcrypt-hashed, validated on every request, bound to a specific hostname
- **Allowlisted log types** — both the webapp and agent validate against a fixed list (Application, System, Security, Setup)
- **No code execution** — the agent only calls the Windows Event Log API, no shell or process spawning
- **Entry cap** — 10,000 log entries per submission to prevent abuse
- **HTTPS** — TLS certificate validation enabled by default in the agent
