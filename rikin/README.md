# AgentOS — AI Village Orchestrator

Orchestrate unlimited AI models simultaneously inside VS Code. Every model with an API key becomes an agent in a gamified Clash-of-Clans-style village dashboard.

Works with **any OpenAI-compatible API** (Grok, Mistral, Groq, Together, DeepSeek, Ollama, LM Studio), plus **Gemini** (Antigravity), **Claude** (Anthropic), **Cursor AI**, and **GitHub Copilot**.

## How It Works

1. Open any project in VS Code (or Cursor)
2. AgentOS extension boots automatically
3. Dashboard opens at `http://localhost:3000` — your agent village
4. Add models by editing `agent_os/agents.json` or using the dashboard UI
5. Create tasks — agents work autonomously
6. Watch the village: agents light up, energy drains, XP ticks, tasks complete

## Architecture

```
VS Code (or Cursor) — the only editor
├── AgentOS Extension — orchestrates everything
│   ├── Dynamic Agent Registry — reads agents.json, hot-reloads
│   ├── Model Router — picks the right adapter per agent
│   ├── Orchestrator — dispatches tasks, handles results
│   ├── Universal Adapter — any OpenAI-compatible API
│   ├── Gemini Adapter — Google/Antigravity
│   ├── Anthropic Adapter — Claude
│   ├── Cursor Bridge — commands inside Cursor, Claude API fallback
│   ├── Copilot Bridge — monitors GitHub Copilot activity
│   ├── Memory System — persistent.json, shared across all agents
│   ├── Task Manager — inbox → active → review → completed
│   ├── Gamification — XP, levels, energy, achievements
│   ├── File Watcher — auto-triggers on save/create/TODO
│   └── Skill Modules — reusable markdown-defined abilities
├── Dashboard Server — Express + WebSocket at localhost:3000
└── React Dashboard — gamified village view
```

## Quick Start

### Prerequisites
- Node.js 18+
- VS Code 1.85+ (or Cursor)
- At least one API key (OpenAI, xAI, Google, Anthropic, etc.)

### Install

```bash
# Clone the repo
git clone <repo-url> && cd agent-os

# Install extension dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..

# Build everything
npm run compile
```

### Configure Agents

Edit `agent_os/agents.json` to add your models:

```json
{
  "agents": [
    {
      "id": "grok",
      "name": "Grok",
      "provider": "openai-compatible",
      "endpoint": "https://api.x.ai/v1",
      "apiKeyEnvVar": "XAI_API_KEY",
      "model": "grok-2",
      "avatar": "lightning",
      "role": "reasoning"
    }
  ]
}
```

Set your API keys as environment variables:

```bash
export OPENAI_API_KEY=sk-...
export XAI_API_KEY=xai-...
export GOOGLE_API_KEY=AIza...
export ANTHROPIC_API_KEY=sk-ant-...
```

### Run

1. Open the project in VS Code
2. Press `F5` to launch the extension in development mode
3. Open `http://localhost:3000` to see the village dashboard
4. Use command palette: `AgentOS: Create Task` or `AgentOS: Set Goal`

### Three Ways to Add Agents

1. **Config file** — edit `agent_os/agents.json` directly
2. **Dashboard UI** — click "Add Agent" button in the village
3. **Command palette** — run `AgentOS: Add Agent` and fill in details

## Task Risk System

- **Low risk** (docs, tests, types, configs) — auto-applied to files, no approval needed
- **High risk** (core logic, refactoring, security) — queued for your review as diffs
- Risk is auto-detected from file paths and task type, or set manually per task

## Agent-to-Agent Task Spawning

Set a high-level goal and a planning agent breaks it into subtasks for other agents:

1. `AgentOS: Set Goal` → "Add user authentication with JWT"
2. Planning agent creates 5 subtasks: middleware, routes, utils, tests, docs
3. Execution agents pick up subtasks in parallel
4. Low-risk results auto-apply, high-risk results queue for review
5. You watch the village while it all happens

## Auto-Triggers

Configure `agent_os/triggers.json` to make agents react to your actions:

- Save a `.ts` file → auto-lint
- Write a `// TODO:` comment → auto-create task
- Create a new file → auto-generate tests
- Git commit → auto-generate changelog

## Gamification

- **Energy**: 0-100 per agent. Drains with token usage, recharges over time.
- **XP**: Earned per task. Speed bonus for fast completions.
- **Levels**: Unlock more simultaneous tasks and priority routing.
- **Achievements**: "First Blood", "Speed Demon", "Centurion", etc.

## Project Structure

```
agent_os/           # Runtime data (per-project)
├── agents.json     # Model registry — add your agents here
├── triggers.json   # Auto-trigger rules
├── memory/         # Shared memory (persistent.json, history.md)
├── tasks/          # Task queue (inbox, active, review, completed)
└── skills/         # Reusable skill modules (markdown)

src/                # Extension source
├── core/           # Orchestrator, registry, event bus, types
├── adapters/       # Model adapters (universal, gemini, anthropic)
├── bridges/        # IDE bridges (cursor, copilot, file watcher)
├── memory/         # Memory manager
├── tasks/          # Task manager
├── skills/         # Skill loader
├── gamification/   # XP, energy, levels
└── dashboard/      # Server + WebView provider

dashboard/          # React frontend (Vite)
└── src/
    ├── components/ # Village, cards, task board, activity feed
    ├── hooks/      # WebSocket, Zustand state
    └── styles/     # Gamified CSS theme
```

## Supported Providers

| Provider | Adapter | Examples |
|---|---|---|
| `openai-compatible` | Universal Adapter | OpenAI, Grok, Mistral, Groq, Together, DeepSeek, Ollama, LM Studio, vLLM |
| `gemini` | Gemini Adapter | Google Gemini (Antigravity) |
| `anthropic` | Anthropic Adapter | Claude |
| `cursor-bridge` | Cursor Bridge | Cursor AI (native commands or Claude API fallback) |
| `copilot-bridge` | Copilot Bridge | GitHub Copilot (activity monitoring) |

## License

MIT
