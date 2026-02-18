# 🏘️ AgentOS — Multi-LLM-System - 3D AI Village Orchestrator

> **Connect your real LLM models and get tasks done.**  
> Orchestrate unlimited AI models in VS Code (or Cursor). Every model with an API key becomes an agent in a gamified village dashboard all agents works together.

[![Built in a day](https://img.shields.io/badge/Built_in-1_day-64ffda?style=flat-square)](https://github.com/Rikinshah787/AgentOS-Multi-LLM-System)  
**🚧 In active development** — early release, feedback welcome!

---

## ⭐ Star & Contribute

If this project helps you, **give it a star** so others can find it.

- **Star** the [repo](https://github.com/Rikinshah787/AgentOS-Multi-LLM-System) ⭐  
- **Contribute** — PRs, issues, and ideas are welcome 🚀  
- **Connect** — [LinkedIn](https://www.linkedin.com/in/rikinshah787) · [Rikin Shah](https://www.linkedin.com/in/rikinshah787)

---

## 🔌 What It Supports

Works with **any OpenAI-compatible API** (Grok, Mistral, Groq, Together, DeepSeek, Ollama, LM Studio), plus **Gemini**, **Claude**, **Cursor AI**, and **GitHub Copilot**.

## 🎯 How It Works

1. Open your project in VS Code or Cursor  
2. AgentOS extension boots automatically  
3. Dashboard runs at `http://localhost:3000` — your agent village 🏠  
4. Add models via `agent_os/agents.json` or the dashboard UI  
5. Create tasks — agents work autonomously  
6. Watch the village: agents light up, XP ticks, tasks complete ✨  

## 🏗️ Architecture

```
VS Code (or Cursor)
├── AgentOS Extension
│   ├── Dynamic Agent Registry · Model Router · Orchestrator
│   ├── Universal + Gemini + Anthropic Adapters
│   ├── Cursor Bridge · Copilot Bridge
│   ├── Memory · Task Manager · Gamification · Skills
│   └── File Watcher · Auto-triggers
├── Dashboard Server (Express + WebSocket @ :3000)
└── React Dashboard — village view
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- VS Code 1.85+ or Cursor
- At least one API key (use a `.env` file — **never commit keys**)

### Install

```bash
git clone https://github.com/Rikinshah787/AgentOS-Multi-LLM-System.git
cd AgentOS-Multi-LLM-System

npm install
cd dashboard && npm install && cd ..
npm run compile
```

### Configure API Keys (no keys in repo)

Create a **`.env`** file in the project root. Use **only placeholder variable names**; put your real keys locally and never commit them.

```env
# Copy this and fill in your keys locally. Do NOT commit .env
OPENAI_API_KEY=
XAI_API_KEY=
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=
GROQ_API_KEY=
NVIDIA_KIMI_API_KEY=
NVIDIA_API_KEY=
```

✅ **`.env` is in `.gitignore`** — the repo contains **no API keys**.

### Configure Agents

Edit `agent_os/agents.json`. Each agent uses `apiKeyEnvVar` (e.g. `MISTRAL_API_KEY`) so the server reads from your env.

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

### Run

**Option A — With VS Code / Cursor**

1. Open the project, press **F5**  
2. Open `http://localhost:3000`  
3. Use **AgentOS: Create Task** or **AgentOS: Set Goal**  

**Option B — Standalone (no extension)**

```bash
node dev-server.js
```

Then open `http://localhost:3000` in your browser.

## 📋 Task Risk · Spawning · Auto-Triggers

- **Low risk** (docs, tests, configs) → auto-applied  
- **High risk** (core logic, security) → queued for review  
- **Set Goal** → planning agent breaks it into subtasks for other agents  
- **Triggers** → e.g. save `.ts` → lint; `// TODO` → create task  

## 🎮 Gamification

- **Energy** 0–100 · **XP** per task · **Levels** · **Achievements** (First Blood, Speed Demon, etc.)

## 📁 Project Structure

```
agent_os/     # agents.json, triggers, memory, tasks, skills
src/          # Extension (core, adapters, bridges, memory, tasks, gamification)
dashboard/    # React frontend (Vite)
```

## 📜 License

MIT

---

**⭐ Star the [repo](https://github.com/Rikinshah787/AgentOS-Multi-LLM-System) · [Connect on LinkedIn](https://www.linkedin.com/in/rikinshah787)**
