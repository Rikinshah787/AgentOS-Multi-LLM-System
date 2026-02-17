/**
 * AgentOS Dev Server — REAL API calls, REAL file creation.
 * Models are instructed to output structured file changes.
 * Auto-approve ON by default — all files auto-written.
 * Files are written to: e:\NewCoolProject\workspace\  (sandbox folder)
 *
 * Features:
 *   - Reinforcement Learning: auto-scores outputs, smart agent routing, adaptive prompts
 *   - Skills injection from agent_os/skills/
 *   - Persistent memory across restarts
 *   - Subtask orchestration (agent-to-agent chaining)
 *   - Auto-exec shell commands from model output
 *
 * Usage: node dev-server.js
 * Then open http://localhost:3000
 */
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const PORT = 3000;
const PROJECT_ROOT = path.join(__dirname, 'workspace');
const MEMORY_PATH = path.join(__dirname, 'agent_os', 'memory', 'persistent.json');
const HISTORY_PATH = path.join(__dirname, 'agent_os', 'memory', 'history.md');
const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

if (!fsSync.existsSync(PROJECT_ROOT)) {
  fsSync.mkdirSync(PROJECT_ROOT, { recursive: true });
}

// ─── Persistent Memory ─────────────────────────────────────────
let memory = { facts: {}, decisions: {}, taskHistory: {}, agentStats: {}, performanceLog: {} };

function loadMemory() {
  try {
    if (fsSync.existsSync(MEMORY_PATH)) {
      const raw = fsSync.readFileSync(MEMORY_PATH, 'utf-8');
      const loaded = JSON.parse(raw);
      memory.facts = loaded.facts || {};
      memory.decisions = loaded.decisions || {};
      memory.taskHistory = loaded.taskHistory || {};
      memory.agentStats = loaded.agentStats || {};
      memory.performanceLog = loaded.performanceLog || {};
      const count = Object.keys(memory.taskHistory).length;
      if (count > 0) console.log(`  [memory] Loaded ${count} past tasks from persistent.json`);
    }
  } catch (err) {
    console.error('  [memory] Failed to load persistent.json:', err.message);
  }
}

function saveMemory() {
  try {
    const entries = Object.entries(memory.taskHistory || {});
    if (entries.length > 50) {
      const sorted = entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      memory.taskHistory = Object.fromEntries(sorted.slice(0, 50));
    }
    const dir = path.dirname(MEMORY_PATH);
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
    fsSync.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.error('  [memory] Failed to save persistent.json:', err.message);
  }
}

function appendHistory(entry) {
  try {
    const ts = new Date().toISOString();
    const line = `- **${ts}**: ${entry}\n`;
    fsSync.appendFileSync(HISTORY_PATH, line, 'utf-8');
  } catch (err) {
    console.error('  [memory] Failed to append history:', err.message);
  }
}

function saveTaskToMemory(task, agent) {
  const output = task.result?.output || '';
  const summary = output.length > 500 ? output.slice(0, 500) + '...' : output;
  memory.taskHistory[task.id] = {
    title: task.title,
    agent: agent.id,
    agentName: agent.config.name,
    model: agent.config.model,
    output: summary,
    rawOutputLength: output.length,
    files: task.result?.files || [],
    tokensUsed: task.result?.tokensUsed || 0,
    success: task.result?.success ?? true,
    timestamp: Date.now(),
  };
  if (!memory.agentStats[agent.id]) {
    memory.agentStats[agent.id] = { totalTasks: 0, totalTokens: 0, lastActive: 0 };
  }
  memory.agentStats[agent.id].totalTasks++;
  memory.agentStats[agent.id].totalTokens += (task.result?.tokensUsed || 0);
  memory.agentStats[agent.id].lastActive = Date.now();
  saveMemory();
  appendHistory(`[${agent.config.name}] completed "${task.title}" (${task.result?.tokensUsed || 0} tokens, files: ${(task.result?.files || []).join(', ') || 'none'})`);
}

function getRecentMemoryContext(limit = 5) {
  const entries = Object.entries(memory.taskHistory);
  if (entries.length === 0) return '';
  const recent = entries
    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
    .slice(0, limit);
  let ctx = '\n\n--- SHARED MEMORY (recent work by all agents) ---\n';
  for (const [taskId, entry] of recent) {
    const shortOutput = (entry.output || '').slice(0, 120).replace(/\n/g, ' ');
    ctx += `[${entry.agentName || entry.agent}] ${taskId}: "${entry.title}" → ${shortOutput}\n`;
    if (entry.files && entry.files.length > 0) {
      ctx += `  Files: ${entry.files.join(', ')}\n`;
    }
  }
  ctx += '--- END SHARED MEMORY ---\n';
  ctx += 'Use this context to build on previous work. If another agent created a file, you can reference or extend it.\n';
  return ctx;
}

loadMemory();

// ─── Load Skills from agent_os/skills/ ──────────────────────────
let skills = [];

function loadSkills() {
  const skillsDir = path.join(__dirname, 'agent_os', 'skills');
  if (!fsSync.existsSync(skillsDir)) return;
  const files = fsSync.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    try {
      const raw = fsSync.readFileSync(path.join(skillsDir, file), 'utf-8').replace(/\r\n/g, '\n');
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      const name = (fm.match(/name:\s*(.+)/) || [])[1]?.trim() || file;
      const triggersRaw = (fm.match(/triggers:\s*(.+)/) || [])[1]?.trim() || '';
      const triggers = triggersRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const templateMatch = raw.match(/## Prompt Template\s*\n```\n([\s\S]*?)\n```/);
      const template = templateMatch ? templateMatch[1].trim() : '';
      if (triggers.length > 0 && template) {
        skills.push({ name, triggers, template, file });
        console.log(`  [skill] Loaded "${name}" (triggers: ${triggers.join(', ')})`);
      }
    } catch (err) {
      console.error(`  [skill] Failed to load ${file}:`, err.message);
    }
  }
  console.log(`  [skill] ${skills.length} skills loaded`);
}

loadSkills();

// ─── Reinforcement Learning Engine ──────────────────────────────

const TASK_TYPE_PATTERNS = {
  'python':     /python|django|flask|fastapi|pip|\.py\b/i,
  'javascript': /javascript|node\.?js|express|react|vue|npm|\.js\b|\.ts\b/i,
  'web':        /html|css|website|frontend|webpage|landing page|ui\b/i,
  'api':        /api|endpoint|rest|graphql|websocket|http/i,
  'test':       /test|spec|coverage|jest|mocha|pytest|unittest/i,
  'refactor':   /refactor|clean|simplify|extract|optimize|improve/i,
  'docs':       /doc|readme|explain|comment|document|markdown/i,
  'devops':     /docker|deploy|ci|cd|pipeline|kubernetes|nginx/i,
  'data':       /database|sql|mongo|redis|csv|json|data|scrape|crawl/i,
  'tool':       /tool|script|cli|utility|helper|automation|bot/i,
};

function classifyTask(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const types = [];
  for (const [type, pattern] of Object.entries(TASK_TYPE_PATTERNS)) {
    if (pattern.test(text)) types.push(type);
  }
  return types.length > 0 ? types : ['general'];
}

function scoreOutput(task, result, files, execBlocks, execResults) {
  let score = 0;
  const output = result?.output || '';
  const rawOutput = result?.rawOutput || output;

  if (files.length > 0) {
    score += 20;
    score += Math.min(20, files.length * 5);
  }
  if (rawOutput.includes('===FILE===')) score += 5;
  if (rawOutput.includes('===CONTENT===')) score += 5;
  if (rawOutput.includes('===END_FILE===')) score += 5;

  if (execBlocks.length > 0 && execResults) {
    const succeeded = execResults.filter(r => r.success).length;
    score += Math.round((succeeded / execBlocks.length) * 15);
  } else if (execBlocks.length === 0) {
    score += 10;
  }

  const tokensUsed = result?.tokensUsed || 0;
  if (tokensUsed > 0 && tokensUsed < 500) score += 15;
  else if (tokensUsed < 2000) score += 12;
  else if (tokensUsed < 5000) score += 8;
  else if (tokensUsed < 10000) score += 4;

  if (task.status !== 'failed') score += 15;

  return Math.min(100, Math.max(0, score));
}

function recordPerformance(agentId, taskTypes, score, taskId) {
  if (!memory.performanceLog[agentId]) {
    memory.performanceLog[agentId] = {};
  }
  for (const type of taskTypes) {
    if (!memory.performanceLog[agentId][type]) {
      memory.performanceLog[agentId][type] = { scores: [], avg: 0, count: 0 };
    }
    const log = memory.performanceLog[agentId][type];
    log.scores.push({ score, taskId, timestamp: Date.now() });
    if (log.scores.length > 20) log.scores = log.scores.slice(-20);
    log.count = log.scores.length;
    log.avg = Math.round(log.scores.reduce((s, e) => s + e.score, 0) / log.count);
  }
  saveMemory();
}

function getAgentScore(agentId, taskType) {
  const log = memory.performanceLog?.[agentId]?.[taskType];
  if (!log || log.count === 0) return 50;
  return log.avg;
}

function getAgentOverallScore(agentId) {
  const agentLog = memory.performanceLog?.[agentId];
  if (!agentLog) return 50;
  const types = Object.values(agentLog);
  if (types.length === 0) return 50;
  const total = types.reduce((s, t) => s + (t.avg || 50), 0);
  return Math.round(total / types.length);
}

function getRecentFailures(agentId) {
  const agentLog = memory.performanceLog?.[agentId];
  if (!agentLog) return 0;
  const allScores = [];
  for (const type of Object.values(agentLog)) {
    for (const s of (type.scores || [])) {
      allScores.push(s);
    }
  }
  allScores.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const recent = allScores.slice(0, 5);
  return recent.filter(s => s.score < 30).length;
}

function printLeaderboard() {
  const agentIds = Object.keys(memory.performanceLog || {});
  if (agentIds.length === 0) return;
  console.log('  [RL] Agent performance leaderboard:');
  const board = agentIds.map(id => {
    const name = agents.find(a => a.id === id)?.config?.name || id;
    const overall = getAgentOverallScore(id);
    const types = Object.keys(memory.performanceLog[id] || {});
    return { name, overall, types };
  }).sort((a, b) => b.overall - a.overall);
  for (const entry of board) {
    const filled = Math.round(entry.overall / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    console.log(`    ${entry.name.padEnd(28)} ${bar} ${entry.overall}/100  (${entry.types.join(', ')})`);
  }
}

// ─── System prompt ──────────────────────────────────────────────
function matchSkills(taskDescription) {
  if (!taskDescription || skills.length === 0) return [];
  const lower = taskDescription.toLowerCase();
  return skills.filter(skill => skill.triggers.some(trigger => lower.includes(trigger)));
}

const ROLE_PROMPTS = {
  'general': 'You are a senior full-stack developer. Write production-quality code with proper error handling, types, and structure. Think before you code.',
  'reasoning': 'You are an expert problem-solver and architect. Break complex problems into clear steps. Write robust, well-structured code with thorough error handling. Think step-by-step before writing any code.',
  'fast-draft': 'You are a rapid prototyping specialist. Write clean, working code quickly. Focus on getting a functional result fast while keeping code readable.',
  'code-review': 'You are a senior code reviewer. Find bugs, security issues, and suggest improvements. When writing code, apply best practices rigorously.',
  'planning': 'You are a technical architect. Design systems with clear separation of concerns, scalability, and maintainability.',
  'inline-completion': 'You are a code completion expert. Write precise, contextually-aware code.',
};

function buildSystemPrompt(agentName, role, taskDescription, agentId) {
  const memoryContext = getRecentMemoryContext();
  const matchedSkills = matchSkills(taskDescription);
  let skillSection = '';
  if (matchedSkills.length > 0) {
    skillSection = '\n═══ ACTIVATED SKILLS ═══\n';
    for (const skill of matchedSkills) {
      skillSection += `--- ${skill.name} ---\n${skill.template}\n`;
    }
    skillSection += '═══ END SKILLS ═══\n';
  }

  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS['general'];

  let adaptiveSection = '';
  if (agentId) {
    const overallScore = getAgentOverallScore(agentId);
    const recentFails = getRecentFailures(agentId);

    if (recentFails >= 3) {
      adaptiveSection = `
CRITICAL: Your recent outputs have not been working. You MUST follow these rules strictly:
1. ALWAYS use the exact ===FILE=== / ===CONTENT=== / ===END_FILE=== markers.
2. NEVER skip files or use placeholders. Write every line of code.
3. Start with a clear plan: "I will create X files: ..."
4. Double-check your code for syntax errors before outputting.
`;
    } else if (overallScore < 40) {
      adaptiveSection = `
NOTE: Make sure to use the exact output format markers (===FILE===, ===CONTENT===, ===END_FILE===).
Write complete, working code. Do not use shorthand or placeholder comments.
`;
    } else if (overallScore >= 75) {
      adaptiveSection = `
You have a strong track record. Feel free to take initiative: suggest improvements, add extra features, or propose architecture changes beyond what was asked.
`;
    }
  }

  return `You are "${agentName}", an AI coding agent in AgentOS (multi-agent system).
${rolePrompt}

RULES:
- Think step-by-step before coding. Plan your approach in 1-2 sentences first.
- Write COMPLETE, RUNNABLE code. Never use placeholder comments like "// ... rest of code".
- Include all imports, all functions, all logic. The code must work if copy-pasted.
- For Node.js projects, always include a complete package.json with all dependencies.
- Handle errors properly. Add input validation. Use modern syntax.
${adaptiveSection}${skillSection}
OUTPUT FORMAT — use these exact markers:

Files: ===FILE=== path: <path> ===CONTENT=== <code> ===END_FILE===
Commands: ===EXEC=== cwd: <dir> cmd: <command> ===END_EXEC===
Subtasks: ===SUBTASK=== title: <title> agent: auto description: <desc> ===END_SUBTASK===

After code blocks, briefly explain what you built and how to use it.
${memoryContext}`;
}

// ─── Parse model response ───────────────────────────────────────
function parseFiles(output) {
  const files = [];
  const regex = /===FILE===\s*\npath:\s*(.+)\n===CONTENT===\n([\s\S]*?)===END_FILE===/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].trimEnd() });
  }
  let explanation = output.replace(regex, '').trim();
  explanation = explanation.replace(/\n{3,}/g, '\n\n').trim();
  return { files, explanation };
}

function parseSubtasks(output) {
  const subtasks = [];
  const regex = /===SUBTASK===\s*\ntitle:\s*(.+)\nagent:\s*(.+)\ndescription:\s*([\s\S]*?)===END_SUBTASK===/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    subtasks.push({ title: match[1].trim(), agent: match[2].trim(), description: match[3].trim() });
  }
  return subtasks;
}

function parseExecBlocks(output) {
  const execs = [];
  const regex = /===EXEC===\s*\ncwd:\s*(.+)\ncmd:\s*(.+)\n===END_EXEC===/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    execs.push({ cwd: match[1].trim(), cmd: match[2].trim() });
  }
  return execs;
}

// ─── Run shell commands in workspace ────────────────────────────
const { execSync } = require('child_process');

async function runExecBlocks(execBlocks, agentId) {
  const results = [];
  for (const block of execBlocks) {
    const fullCwd = path.join(PROJECT_ROOT, block.cwd);
    if (!fullCwd.startsWith(PROJECT_ROOT)) {
      addActivity(agentId, 'exec:blocked', `Blocked unsafe cwd: ${block.cwd}`);
      continue;
    }
    if (!fsSync.existsSync(fullCwd)) {
      await fs.mkdir(fullCwd, { recursive: true });
    }
    try {
      addActivity(agentId, 'exec:running', `Running: ${block.cmd} (in workspace/${block.cwd})`);
      const output = execSync(block.cmd, {
        cwd: fullCwd, timeout: 120000, encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' },
      });
      const trimmed = (output || '').slice(-500);
      results.push({ cwd: block.cwd, cmd: block.cmd, success: true, output: trimmed });
      addActivity(agentId, 'exec:done', `Completed: ${block.cmd}`);
      console.log(`  [exec] done: ${block.cmd} in workspace/${block.cwd}`);
    } catch (err) {
      const stderr = (err.stderr || err.message || '').slice(-300);
      results.push({ cwd: block.cwd, cmd: block.cmd, success: false, output: stderr });
      addActivity(agentId, 'exec:error', `Failed: ${block.cmd} — ${stderr.slice(0, 100)}`);
      console.log(`  [exec] fail: ${block.cmd}: ${stderr.slice(0, 100)}`);
    }
  }
  return results;
}

// ─── Write files to workspace ──────────────────────────────────
async function writeFiles(files) {
  const written = [];
  for (const file of files) {
    const fullPath = path.join(PROJECT_ROOT, file.path);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
    written.push(file.path);
    console.log(`  [file] Written: workspace/${file.path}`);
  }
  return written;
}

// ─── Load agents from agents.json ──────────────────────────────
function loadAgents() {
  const configPath = path.join(__dirname, 'agent_os', 'agents.json');
  if (!fsSync.existsSync(configPath)) return [];
  const raw = fsSync.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  return config.agents.map(agent => ({
    id: agent.id,
    config: agent,
    status: resolveAgentStatus(agent),
    energy: 100, maxEnergy: 100,
    xp: 0, level: 1,
    tasksCompleted: 0, tasksInProgress: 0,
    currentTaskId: null, lastActive: Date.now(),
    totalTokensUsed: 0, errorCount: 0, cooldownUntil: null,
  }));
}

function resolveAgentStatus(agent) {
  if (agent.provider === 'cursor-bridge' || agent.provider === 'copilot-bridge') return 'idle';
  if (!agent.apiKeyEnvVar || agent.apiKeyEnvVar === '') return 'idle';
  const key = process.env[agent.apiKeyEnvVar];
  return (key && key.length > 0) ? 'idle' : 'offline';
}

let agents = loadAgents();
let tasks = [];
let archivedTaskCount = 0;
let taskCounter = 0;
let activity = [];
let totalGlobalTokens = 0;
let autoApproveAll = true;

// ─── Performance: Throttled broadcast ───────────────────────────
let broadcastPending = false;
let lastBroadcastTime = 0;
const BROADCAST_MIN_INTERVAL = 300;

function scheduleBroadcast() {
  if (broadcastPending) return;
  const elapsed = Date.now() - lastBroadcastTime;
  if (elapsed >= BROADCAST_MIN_INTERVAL) {
    doBroadcastState();
  } else {
    broadcastPending = true;
    setTimeout(() => {
      broadcastPending = false;
      doBroadcastState();
    }, BROADCAST_MIN_INTERVAL - elapsed);
  }
}

function doBroadcastState() {
  lastBroadcastTime = Date.now();
  broadcast({ type: 'state:full', payload: getFullState(), timestamp: Date.now() });
}

function cleanupTasks() {
  const MAX_VISIBLE = 30;
  const finished = tasks.filter(t =>
    t.status === 'completed' || t.status === 'cancelled' || t.status === 'failed');
  if (finished.length > MAX_VISIBLE) {
    const toArchive = finished
      .sort((a, b) => (a.completed || 0) - (b.completed || 0))
      .slice(0, finished.length - MAX_VISIBLE);
    const archiveIds = new Set(toArchive.map(t => t.id));
    archivedTaskCount += archiveIds.size;
    tasks = tasks.filter(t => !archiveIds.has(t.id));
  }
}

// ─── State helpers ─────────────────────────────────────────────
function getFullState() {
  const taskHistoryEntries = Object.entries(memory.taskHistory || {});
  const recentMemory = taskHistoryEntries
    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
    .slice(0, 10)
    .map(([id, entry]) => ({
      taskId: id, title: entry.title, agent: entry.agent,
      agentName: entry.agentName, model: entry.model,
      output: (entry.output || '').slice(0, 200),
      files: entry.files || [], tokensUsed: entry.tokensUsed || 0,
      success: entry.success, timestamp: entry.timestamp,
    }));

  const lightTasks = tasks.map(t => {
    const { result, ...rest } = t;
    if (!result) return rest;
    const { rawOutput, fileContents, ...lightResult } = result;
    return { ...rest, result: { ...lightResult, output: (lightResult.output || '').slice(0, 500) } };
  });

  const performanceSummary = {};
  for (const a of agents) {
    const overall = getAgentOverallScore(a.id);
    const agentLog = memory.performanceLog?.[a.id] || {};
    const typeScores = {};
    for (const [type, data] of Object.entries(agentLog)) {
      typeScores[type] = { avg: data.avg || 0, count: data.count || 0 };
    }
    performanceSummary[a.id] = { overall, recentFailures: getRecentFailures(a.id), typeScores };
  }

  return {
    agents,
    tasks: lightTasks,
    autoApproveAll,
    performance: performanceSummary,
    memory: {
      totalRemembered: taskHistoryEntries.length,
      agentStats: memory.agentStats || {},
      recent: recentMemory,
    },
    gamification: {
      agents: {},
      achievements: [
        { id: 'first-blood', name: 'First Blood', description: 'Complete the first task', unlockedBy: null, unlockedAt: null },
        { id: 'speed-demon', name: 'Speed Demon', description: 'Complete a task in under 10 seconds', unlockedBy: null, unlockedAt: null },
        { id: 'team-player', name: 'Team Player', description: 'Use all registered agents', unlockedBy: null, unlockedAt: null },
      ],
      globalStats: {
        totalTasks: (tasks.filter(t => t.status === 'completed').length) + archivedTaskCount,
        totalTokens: totalGlobalTokens,
        totalAgentsUsed: agents.filter(a => a.tasksCompleted > 0).length,
        startedAt: Date.now(),
      },
    },
    activity: activity.slice(-50),
  };
}

function addActivity(agentId, type, message) {
  const entry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(), agentId,
    agentName: agents.find(a => a.id === agentId)?.config?.name || agentId,
    type, message,
  };
  activity.push(entry);
  if (activity.length > 100) activity = activity.slice(-100);
  broadcast({ type: 'activity:log', payload: entry, timestamp: Date.now() });
  console.log(`  [${type}] ${message}`);
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(data); });
}

function broadcastState() {
  scheduleBroadcast();
}

// ─── REAL API call (streaming for NIM, 5min safety timeout) ─────
async function callModel(agent, prompt) {
  const config = agent.config;
  const apiKey = config.apiKeyEnvVar ? process.env[config.apiKeyEnvVar] : '';

  if (!apiKey && config.provider === 'openai-compatible' && config.apiKeyEnvVar) {
    throw new Error(`No API key for ${config.apiKeyEnvVar}`);
  }
  if (config.provider === 'cursor-bridge' || config.provider === 'copilot-bridge') {
    throw new Error(`${config.name} is an IDE bridge — not callable from dev server`);
  }

  const isNvidiaNim = (config.endpoint || '').includes('integrate.api.nvidia.com');

  const client = new OpenAI({
    apiKey: apiKey || 'not-needed',
    baseURL: config.endpoint || 'https://api.openai.com/v1',
    timeout: 300000, // 5-min safety net so nothing hangs forever
  });

  const systemPrompt = buildSystemPrompt(config.name, config.role, prompt, agent.id);

  const params = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: config.maxTokens || 4096,
    temperature: 0.3,
  };

  // NVIDIA NIM models need extra_body AND streaming to work
  if (isNvidiaNim) {
    if (config.model === 'z-ai/glm5') {
      params.extra_body = { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } };
    } else if (config.model === 'moonshotai/kimi-k2.5') {
      params.extra_body = { chat_template_kwargs: { thinking: true } };
    }
    // NIM endpoints require streaming — non-streaming hangs forever
    params.stream = true;
    const stream = await client.chat.completions.create(params);
    let output = '';
    let tokensUsed = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) output += delta.content;
      if (chunk.usage?.total_tokens) tokensUsed = chunk.usage.total_tokens;
    }
    if (!tokensUsed) tokensUsed = Math.ceil(output.length / 4);
    return { output: output || '(no response)', tokensUsed };
  }

  // Standard non-streaming for Mistral, Groq, OpenAI, etc.
  const response = await client.chat.completions.create(params);
  const output = response.choices?.[0]?.message?.content || '(no response)';
  const tokensUsed = response.usage?.total_tokens || Math.ceil(output.length / 4);
  return { output, tokensUsed };
}

// ─── Smart Agent Picker (performance-weighted) ──────────────────
let lastAgentIndex = -1;

function getCallableAgents() {
  return agents.filter(
    a => a.status === 'idle' &&
    a.config.provider !== 'cursor-bridge' &&
    a.config.provider !== 'copilot-bridge' &&
    a.status !== 'offline'
  );
}

function pickAgent(preferredAgentId, taskTitle, taskDescription) {
  const available = getCallableAgents();
  if (available.length === 0) return null;

  if (preferredAgentId && preferredAgentId !== 'auto') {
    const specific = available.find(a => a.id === preferredAgentId);
    if (specific) return specific;
  }

  const taskTypes = classifyTask(taskTitle || '', taskDescription || '');
  const scored = available.map(a => {
    let typeScore = 0;
    for (const type of taskTypes) {
      typeScore += getAgentScore(a.id, type);
    }
    typeScore = typeScore / taskTypes.length;

    const totalTasksForTypes = taskTypes.reduce((sum, type) => {
      return sum + (memory.performanceLog?.[a.id]?.[type]?.count || 0);
    }, 0);
    const explorationBonus = totalTasksForTypes < 3 ? 15 : 0;

    const failures = getRecentFailures(a.id);
    const failurePenalty = failures * 10;

    const finalScore = typeScore + explorationBonus - failurePenalty;
    return { agent: a, score: finalScore, taskTypes };
  });

  scored.sort((a, b) => b.score - a.score);

  const topN = scored.slice(0, Math.min(3, scored.length));
  const totalWeight = topN.reduce((s, e) => s + Math.max(1, e.score), 0);
  let roll = Math.random() * totalWeight;
  for (const candidate of topN) {
    roll -= Math.max(1, candidate.score);
    if (roll <= 0) {
      const types = candidate.taskTypes.join(',');
      console.log(`  [RL] Picked ${candidate.agent.config.name} (score: ${Math.round(candidate.score)}) for [${types}]`);
      return candidate.agent;
    }
  }

  return topN[0]?.agent || available[0];
}

// ─── Execute a task with REAL API + REAL file creation ─────────
async function executeTask(task, agent) {
  addActivity(agent.id, 'agent:working', `${agent.config.name} started working on "${task.title}"`);
  broadcastState();

  try {
    const result = await callModel(agent, task.description);
    const { files, explanation } = parseFiles(result.output);
    const subtasks = parseSubtasks(result.output);
    const execBlocks = parseExecBlocks(result.output);

    const tokensUsed = result.tokensUsed;
    const energyCost = Math.min(5, Math.ceil(tokensUsed / 1000));
    agent.energy = Math.max(0, agent.energy - energyCost);
    agent.totalTokensUsed += tokensUsed;
    agent.tasksCompleted++;
    agent.xp += 20 + Math.min(30, Math.floor(tokensUsed / 100));
    agent.level = Math.floor(agent.xp / 300) + 1;
    totalGlobalTokens += tokensUsed;

    task.result = {
      success: true,
      output: explanation || result.output,
      rawOutput: result.output,
      tokensUsed,
      agentName: agent.config.name,
      model: agent.config.model,
      files: files.map(f => f.path),
      fileContents: files,
    };

    if (files.length > 0 && task.risk === 'low') {
      const written = await writeFiles(files);
      addActivity(agent.id, 'file:auto-applied',
        `Files written to workspace/: ${written.join(', ')}`);
      if (execBlocks.length > 0) {
        addActivity(agent.id, 'exec:starting',
          `${agent.config.name} running ${execBlocks.length} command(s)...`);
        broadcastState();
        const execResults = await runExecBlocks(execBlocks, agent.id);
        task.result.execResults = execResults;
      }
      task.status = 'completed';
      task.completed = Date.now();
      addActivity(agent.id, 'agent:completed',
        `${agent.config.name} completed "${task.title}" — created ${written.join(', ')}${execBlocks.length > 0 ? ' + ran commands' : ''} (auto-applied)`);
    } else if (files.length > 0 && task.risk === 'high') {
      task.status = 'review';
      task.result.execBlocks = execBlocks;
      addActivity(agent.id, 'task:review-needed',
        `${agent.config.name} wants to create ${files.map(f => f.path).join(', ')}${execBlocks.length > 0 ? ` + run ${execBlocks.length} command(s)` : ''} — APPROVE to write files`);
    } else {
      task.status = 'completed';
      task.completed = Date.now();
      addActivity(agent.id, 'agent:completed',
        `${agent.config.name} responded to "${task.title}" (${tokensUsed} tokens)`);
    }

    // RL: Score and record
    const taskTypes = classifyTask(task.title, task.description);
    const perfScore = scoreOutput(task, result, files, execBlocks, task.result.execResults);
    recordPerformance(agent.id, taskTypes, perfScore, task.id);
    task.result.perfScore = perfScore;
    task.result.taskTypes = taskTypes;
    addActivity(agent.id, 'rl:scored',
      `${agent.config.name} scored ${perfScore}/100 on [${taskTypes.join(', ')}] (avg: ${getAgentOverallScore(agent.id)})`);

    saveTaskToMemory(task, agent);

    if (subtasks.length > 0 && task.depth < 3) {
      for (const sub of subtasks) {
        const childTask = createTask(sub.title, sub.description, sub.agent === 'auto' ? 'auto' : sub.agent);
        childTask.parentTaskId = task.id;
        childTask.depth = (task.depth || 0) + 1;
        childTask.createdBy = `agent:${agent.id}`;
        addActivity(agent.id, 'task:spawned',
          `${agent.config.name} spawned subtask "${sub.title}" → ${sub.agent}`);
        appendHistory(`[orchestration] ${agent.config.name} spawned subtask "${sub.title}" for ${sub.agent}`);
      }
    }

    addActivity(agent.id, 'agent:xp-gained',
      `${agent.config.name} +${20 + Math.min(30, Math.floor(tokensUsed / 100))} XP → Level ${agent.level}`);

  } catch (err) {
    task.status = 'failed';
    task.completed = Date.now();
    task.result = { success: false, output: err.message, tokensUsed: 0, files: [] };
    agent.errorCount++;
    // RL: API/infra errors (400, 500, timeout) get mild penalty, not full 0
    const isApiError = err.status === 400 || err.status === 500 || err.status === 502 || err.status === 503
      || (err.message && (err.message.includes('timed out') || err.message.includes('timeout') || err.message.includes('ECONNREFUSED')));
    const failScore = isApiError ? 25 : 0; // API issues = 25, real bad output = 0
    const failTypes = classifyTask(task.title, task.description);
    recordPerformance(agent.id, failTypes, failScore, task.id);
    addActivity(agent.id, 'rl:scored',
      `${agent.config.name} scored ${failScore}/100 (${isApiError ? 'API ERROR' : 'FAILED'}) on [${failTypes.join(', ')}]`);
    addActivity(agent.id, 'agent:error', `${agent.config.name} failed: ${err.message}`);
    appendHistory(`[error] ${agent.config.name} failed on "${task.title}": ${err.message}`);
    if (err.status === 429) {
      agent.cooldownUntil = Date.now() + 60000;
      agent.status = 'cooldown';
      addActivity(agent.id, 'agent:cooldown', `${agent.config.name} rate limited — 60s cooldown`);
    }
  } finally {
    if (agent.status === 'working') agent.status = 'idle';
    agent.currentTaskId = null;
    cleanupTasks();
    broadcastState();
  }
}

// ─── Dispatch ───────────────────────────────────────────────────
function runDispatch() {
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  for (const task of pendingTasks) {
    const agent = pickAgent(task.preferredAgentId, task.title, task.description);
    if (!agent) continue;

    agent.status = 'working';
    agent.currentTaskId = task.id;
    task.status = 'active';
    task.assignedAgentId = agent.id;
    task.started = Date.now();

    executeTask(task, agent).catch(err => {
      console.error(`  [error] Task ${task.id} failed:`, err.message);
    });
  }
}

setInterval(runDispatch, 500);

// Energy recharge every 30s
setInterval(() => {
  let changed = false;
  agents.forEach(a => {
    if (a.status !== 'offline') {
      const rate = Math.max(5, a.config.energyRechargeRate || 5);
      const before = a.energy;
      a.energy = Math.min(a.maxEnergy, a.energy + rate);
      if (a.energy !== before) changed = true;
    }
    if (a.cooldownUntil && Date.now() > a.cooldownUntil) {
      a.cooldownUntil = null;
      if (a.status === 'cooldown') a.status = 'idle';
      changed = true;
    }
  });
  if (changed) broadcastState();
}, 30000);

// ─── WebSocket ─────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('  [ws] Client connected');
  ws.send(JSON.stringify({ type: 'state:full', payload: getFullState(), timestamp: Date.now() }));

  ws.on('message', (data) => {
    try {
      handleCommand(JSON.parse(data.toString()));
    } catch (err) {
      console.error('  [ws] Bad message:', err.message);
    }
  });
});

function handleCommand(msg) {
  switch (msg.type) {
    case 'command:createTask': {
      const { title, description, agentId, agentIds } = msg.payload;
      if (agentIds && Array.isArray(agentIds) && agentIds.length > 0) {
        for (const aid of agentIds) {
          createTask(`${title}`, description || title, aid);
        }
        addActivity('system', 'task:created',
          `Dispatched "${title}" to ${agentIds.length} agents simultaneously`);
      } else {
        createTask(title, description || title, agentId);
      }
      break;
    }
    case 'command:addAgent': {
      const config = msg.payload;
      agents.push({
        id: config.id, config, status: 'idle', energy: 100, maxEnergy: 100,
        xp: 0, level: 1, tasksCompleted: 0, tasksInProgress: 0,
        currentTaskId: null, lastActive: Date.now(), totalTokensUsed: 0,
        errorCount: 0, cooldownUntil: null,
      });
      addActivity(config.id, 'agent:registered', `${config.name} joined the village!`);
      broadcastState();
      break;
    }
    case 'command:approveTask': {
      approveTask(msg.payload.taskId);
      break;
    }
    case 'command:rejectTask': {
      const t = tasks.find(t => t.id === msg.payload.taskId);
      if (t) { t.status = 'cancelled'; t.completed = Date.now(); }
      addActivity('system', 'task:rejected', `Task ${msg.payload.taskId} rejected — no files written`);
      broadcastState();
      break;
    }
    case 'command:toggleAutoApprove': {
      autoApproveAll = !autoApproveAll;
      addActivity('system', 'config:changed', `Auto-approve is now ${autoApproveAll ? 'ON' : 'OFF'}`);
      console.log(`  [config] Auto-approve toggled: ${autoApproveAll ? 'ON' : 'OFF'}`);
      broadcastState();
      break;
    }
  }
}

async function approveTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.result) return;

  if (task.result.fileContents && task.result.fileContents.length > 0) {
    const written = await writeFiles(task.result.fileContents);
    addActivity('system', 'task:approved',
      `Task ${taskId} approved — files written: ${written.join(', ')}`);

    if (task.result.execBlocks && task.result.execBlocks.length > 0) {
      addActivity('system', 'exec:starting',
        `Running ${task.result.execBlocks.length} command(s) for approved task...`);
      broadcastState();
      const execResults = await runExecBlocks(task.result.execBlocks, 'system');
      task.result.execResults = execResults;
      const succeeded = execResults.filter(r => r.success).length;
      addActivity('system', 'exec:done',
        `Commands: ${succeeded}/${execResults.length} succeeded`);
    }
  } else {
    addActivity('system', 'task:approved', `Task ${taskId} approved`);
  }

  task.status = 'completed';
  task.completed = Date.now();
  broadcastState();
}

function createTask(title, description, preferredAgentId) {
  const risk = autoApproveAll ? 'low' : (/test|doc|readme|comment|type|hello|simple|example/i.test(title) ? 'low' : 'high');
  const taskTypes = classifyTask(title, description);
  const task = {
    id: `TASK-${String(++taskCounter).padStart(3, '0')}`,
    title, description, status: 'pending', risk, priority: 'medium',
    assignedAgentId: null, createdBy: 'user', parentTaskId: null,
    depth: 0, created: Date.now(), started: null, completed: null,
    result: null, filePaths: [], tags: taskTypes,
    preferredAgentId: preferredAgentId || 'auto',
  };
  tasks.push(task);
  const agentNote = preferredAgentId && preferredAgentId !== 'auto'
    ? ` → assigned to ${agents.find(a => a.id === preferredAgentId)?.config?.name || preferredAgentId}`
    : ' → auto-assign';
  addActivity('system', 'task:created', `New task: ${task.id} — "${title}" [${risk} risk]${agentNote}`);
  broadcastState();
  runDispatch();
  return task;
}

// ─── REST API ──────────────────────────────────────────────────
app.post('/api/task', (req, res) => {
  const { title, description, agentId } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  res.json(createTask(title, description || title, agentId));
});
app.get('/api/state', (_req, res) => res.json(getFullState()));
app.get('/api/task/:id', (req, res) => {
  const t = tasks.find(t => t.id === req.params.id);
  t ? res.json(t) : res.status(404).json({ error: 'not found' });
});

app.use('/workspace', express.static(PROJECT_ROOT));

const dashboardDist = path.join(__dirname, 'dashboard', 'dist');
if (fsSync.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get('*', (_req, res) => res.sendFile(path.join(dashboardDist, 'index.html')));
}

// ─── Start ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  const online = agents.filter(a => a.status !== 'offline');
  const offline = agents.filter(a => a.status === 'offline');
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════╗');
  console.log('  ║   AgentOS Village — REAL API + REAL FILE CREATION     ║');
  console.log(`  ║   Dashboard:   http://localhost:${PORT}                  ║`);
  console.log(`  ║   Files at:    workspace/                              ║`);
  console.log(`  ║   Agents:      ${online.length} online, ${offline.length} offline                    ║`);
  console.log('  ╚═══════════════════════════════════════════════════════╝');
  console.log('');
  agents.forEach(a => {
    const icon = a.status === 'offline' ? '○' : '●';
    const note = a.status === 'offline' ? 'NO KEY' : 'READY';
    console.log(`  ${icon} ${a.config.name.padEnd(28)} [${note}]`);
  });
  console.log('');
  console.log(`  Files will be created in: ${PROJECT_ROOT}`);
  console.log('  Auto-approve: ON — all tasks auto-write files.');
  console.log('');
  printLeaderboard();
  console.log('');
});
