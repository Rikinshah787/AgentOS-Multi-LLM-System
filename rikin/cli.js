#!/usr/bin/env node
/**
 * AgentOS CLI — Interactive Terminal Mode
 * Launched by start.js when user picks Terminal mode.
 * Uses the same engine as dev-server.js but outputs to the terminal.
 */
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');
const OpenAI = require('openai');
const { execSync } = require('child_process');
require('dotenv').config();

const PROJECT_ROOT = path.join(__dirname, 'workspace');
const MEMORY_PATH = path.join(__dirname, 'agent_os', 'memory', 'persistent.json');
const HISTORY_PATH = path.join(__dirname, 'agent_os', 'memory', 'history.md');

if (!fsSync.existsSync(PROJECT_ROOT)) {
  fsSync.mkdirSync(PROJECT_ROOT, { recursive: true });
}

// ANSI colors
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', magenta: '\x1b[35m', white: '\x1b[37m',
  blue: '\x1b[34m',
};

function print(msg = '') { process.stdout.write(msg + '\n'); }

// Typing effect
function typeText(text, speed = 6) {
  return new Promise((resolve) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        process.stdout.write(text[i]);
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}

// ─── Persistent Memory (same as dev-server) ────────────────────
let memory = { facts: {}, decisions: {}, taskHistory: {}, agentStats: {}, performanceLog: {} };

function loadMemory() {
  try {
    if (fsSync.existsSync(MEMORY_PATH)) {
      const raw = fsSync.readFileSync(MEMORY_PATH, 'utf-8');
      const loaded = JSON.parse(raw);
      memory = { ...memory, ...loaded };
    }
  } catch (err) { /* ignore */ }
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
  } catch (err) { /* ignore */ }
}

function appendHistory(entry) {
  try {
    const ts = new Date().toISOString();
    fsSync.appendFileSync(HISTORY_PATH, `- **${ts}**: ${entry}\n`, 'utf-8');
  } catch (err) { /* ignore */ }
}

// ─── Load Skills ───────────────────────────────────────────────
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
      if (triggers.length > 0 && template) skills.push({ name, triggers, template });
    } catch (err) { /* skip */ }
  }
}

// ─── RL Engine (same as dev-server) ─────────────────────────────
const TASK_TYPE_PATTERNS = {
  'python': /python|django|flask|fastapi|pip|\.py\b/i,
  'javascript': /javascript|node\.?js|express|react|vue|npm|\.js\b|\.ts\b/i,
  'web': /html|css|website|frontend|webpage|landing page|ui\b/i,
  'api': /api|endpoint|rest|graphql|websocket|http/i,
  'test': /test|spec|coverage|jest|mocha|pytest|unittest/i,
  'refactor': /refactor|clean|simplify|extract|optimize|improve/i,
  'docs': /doc|readme|explain|comment|document|markdown/i,
  'data': /database|sql|mongo|redis|csv|json|data|scrape|crawl/i,
  'tool': /tool|script|cli|utility|helper|automation|bot/i,
};

function classifyTask(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  const types = [];
  for (const [type, pattern] of Object.entries(TASK_TYPE_PATTERNS)) { if (pattern.test(text)) types.push(type); }
  return types.length > 0 ? types : ['general'];
}

function getAgentScore(agentId, taskType) {
  const log = memory.performanceLog?.[agentId]?.[taskType];
  return (log && log.count > 0) ? log.avg : 50;
}

function getAgentOverallScore(agentId) {
  const agentLog = memory.performanceLog?.[agentId];
  if (!agentLog) return 50;
  const types = Object.values(agentLog);
  if (types.length === 0) return 50;
  return Math.round(types.reduce((s, t) => s + (t.avg || 50), 0) / types.length);
}

function getRecentFailures(agentId) {
  const agentLog = memory.performanceLog?.[agentId];
  if (!agentLog) return 0;
  const allScores = [];
  for (const type of Object.values(agentLog)) { for (const s of (type.scores || [])) allScores.push(s); }
  allScores.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return allScores.slice(0, 5).filter(s => s.score < 30).length;
}

function recordPerformance(agentId, taskTypes, score, taskId) {
  if (!memory.performanceLog[agentId]) memory.performanceLog[agentId] = {};
  for (const type of taskTypes) {
    if (!memory.performanceLog[agentId][type]) memory.performanceLog[agentId][type] = { scores: [], avg: 0, count: 0 };
    const log = memory.performanceLog[agentId][type];
    log.scores.push({ score, taskId, timestamp: Date.now() });
    if (log.scores.length > 20) log.scores = log.scores.slice(-20);
    log.count = log.scores.length;
    log.avg = Math.round(log.scores.reduce((s, e) => s + e.score, 0) / log.count);
  }
  saveMemory();
}

function scoreOutput(files, execBlocks, execResults, tokensUsed, failed) {
  let score = 0;
  if (files.length > 0) { score += 20; score += Math.min(20, files.length * 5); }
  if (files.length > 0) score += 15; // followed format
  if (execBlocks.length > 0 && execResults) {
    const ok = execResults.filter(r => r.success).length;
    score += Math.round((ok / execBlocks.length) * 15);
  } else if (execBlocks.length === 0) { score += 10; }
  if (tokensUsed > 0 && tokensUsed < 2000) score += 12;
  else if (tokensUsed < 5000) score += 8;
  else if (tokensUsed < 10000) score += 4;
  if (!failed) score += 15;
  return Math.min(100, Math.max(0, score));
}

// ─── System Prompt ─────────────────────────────────────────────
const ROLE_PROMPTS = {
  'general': 'You are a senior full-stack developer. Write production-quality code.',
  'reasoning': 'You are an expert problem-solver. Break complex problems into clear steps. Think step-by-step.',
  'fast-draft': 'You are a rapid prototyping specialist. Write clean, working code quickly.',
  'code-review': 'You are a senior code reviewer. Find bugs, security issues, suggest improvements.',
  'planning': 'You are a technical architect. Design systems with clear separation of concerns.',
  'inline-completion': 'You are a code completion expert. Write precise code.',
};

function matchSkills(desc) {
  if (!desc || skills.length === 0) return [];
  const lower = desc.toLowerCase();
  return skills.filter(s => s.triggers.some(t => lower.includes(t)));
}

function getRecentMemoryContext() {
  const entries = Object.entries(memory.taskHistory);
  if (entries.length === 0) return '';
  const recent = entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).slice(0, 5);
  let ctx = '\n--- SHARED MEMORY ---\n';
  for (const [id, e] of recent) {
    ctx += `[${e.agentName || e.agent}] ${id}: "${e.title}" → ${(e.output || '').slice(0, 100).replace(/\n/g, ' ')}\n`;
  }
  ctx += '--- END ---\n';
  return ctx;
}

function buildSystemPrompt(agentName, role, taskDesc, agentId) {
  const matched = matchSkills(taskDesc);
  let skillSec = '';
  if (matched.length > 0) {
    skillSec = '\n═══ SKILLS ═══\n';
    for (const s of matched) skillSec += `--- ${s.name} ---\n${s.template}\n`;
    skillSec += '═══ END ═══\n';
  }
  const roleP = ROLE_PROMPTS[role] || ROLE_PROMPTS['general'];
  let adaptive = '';
  if (agentId) {
    const fails = getRecentFailures(agentId);
    const overall = getAgentOverallScore(agentId);
    if (fails >= 3) adaptive = '\nCRITICAL: Use exact ===FILE=== markers. Write COMPLETE code.\n';
    else if (overall < 40) adaptive = '\nNOTE: Use exact output format markers.\n';
    else if (overall >= 75) adaptive = '\nYou have a strong track record. Take initiative.\n';
  }

  return `You are "${agentName}", an AI coding agent in AgentOS.
${roleP}

RULES:
- Think step-by-step. Plan in 1-2 sentences first.
- Write COMPLETE, RUNNABLE code. No placeholders.
- Include all imports and dependencies.
${adaptive}${skillSec}
OUTPUT FORMAT:
Files: ===FILE=== path: <path> ===CONTENT=== <code> ===END_FILE===
Commands: ===EXEC=== cwd: <dir> cmd: <command> ===END_EXEC===
Subtasks: ===SUBTASK=== title: <title> agent: auto description: <desc> ===END_SUBTASK===
${getRecentMemoryContext()}`;
}

// ─── Parse functions ───────────────────────────────────────────
function parseFiles(output) {
  const files = [];
  const regex = /===FILE===\s*\npath:\s*(.+)\n===CONTENT===\n([\s\S]*?)===END_FILE===/g;
  let m;
  while ((m = regex.exec(output)) !== null) files.push({ path: m[1].trim(), content: m[2].trimEnd() });
  return files;
}

function parseSubtasks(output) {
  const subs = [];
  const regex = /===SUBTASK===\s*\ntitle:\s*(.+)\nagent:\s*(.+)\ndescription:\s*([\s\S]*?)===END_SUBTASK===/g;
  let m;
  while ((m = regex.exec(output)) !== null) subs.push({ title: m[1].trim(), agent: m[2].trim(), description: m[3].trim() });
  return subs;
}

function parseExecBlocks(output) {
  const execs = [];
  const regex = /===EXEC===\s*\ncwd:\s*(.+)\ncmd:\s*(.+)\n===END_EXEC===/g;
  let m;
  while ((m = regex.exec(output)) !== null) execs.push({ cwd: m[1].trim(), cmd: m[2].trim() });
  return execs;
}

// ─── File writing + Exec ───────────────────────────────────────
async function writeFiles(files) {
  const written = [];
  for (const file of files) {
    const fullPath = path.join(PROJECT_ROOT, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
    written.push(file.path);
  }
  return written;
}

async function runExecBlocks(execBlocks) {
  const results = [];
  for (const block of execBlocks) {
    const fullCwd = path.join(PROJECT_ROOT, block.cwd);
    if (!fullCwd.startsWith(PROJECT_ROOT)) continue;
    if (!fsSync.existsSync(fullCwd)) await fs.mkdir(fullCwd, { recursive: true });
    try {
      const output = execSync(block.cmd, {
        cwd: fullCwd, timeout: 120000, encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' },
      });
      results.push({ cmd: block.cmd, cwd: block.cwd, success: true, output: (output || '').slice(-300) });
    } catch (err) {
      results.push({ cmd: block.cmd, cwd: block.cwd, success: false, output: (err.stderr || err.message || '').slice(-200) });
    }
  }
  return results;
}

// ─── Load Agents ───────────────────────────────────────────────
function loadAgents() {
  const configPath = path.join(__dirname, 'agent_os', 'agents.json');
  if (!fsSync.existsSync(configPath)) return [];
  const config = JSON.parse(fsSync.readFileSync(configPath, 'utf-8'));
  return config.agents.filter(a =>
    a.provider !== 'cursor-bridge' && a.provider !== 'copilot-bridge'
  ).map(a => {
    const keyVar = a.apiKeyEnvVar;
    const hasKey = keyVar ? (process.env[keyVar] && process.env[keyVar].length > 0) : true;
    return { ...a, online: hasKey };
  });
}

// ─── API Call (streaming for NIM, 5min safety timeout) ────────
async function callModel(agent, prompt) {
  const apiKey = agent.apiKeyEnvVar ? process.env[agent.apiKeyEnvVar] : '';
  const isNvidiaNim = (agent.endpoint || '').includes('integrate.api.nvidia.com');

  const client = new OpenAI({
    apiKey: apiKey || 'not-needed',
    baseURL: agent.endpoint || 'https://api.openai.com/v1',
    timeout: 300000, // 5-min safety net
  });

  const systemPrompt = buildSystemPrompt(agent.name, agent.role, prompt, agent.id);
  const params = {
    model: agent.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    max_tokens: agent.maxTokens || 4096,
    temperature: 0.3,
  };

  if (isNvidiaNim) {
    if (agent.model === 'z-ai/glm5') params.extra_body = { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } };
    else if (agent.model === 'moonshotai/kimi-k2.5') params.extra_body = { chat_template_kwargs: { thinking: true } };
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

  const response = await client.chat.completions.create(params);
  const output = response.choices?.[0]?.message?.content || '(no response)';
  const tokensUsed = response.usage?.total_tokens || Math.ceil(output.length / 4);
  return { output, tokensUsed };
}

// ─── Smart Agent Picker ────────────────────────────────────────
function pickAgent(available, title, desc) {
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];
  const taskTypes = classifyTask(title, desc);
  const scored = available.map(a => {
    let ts = 0;
    for (const t of taskTypes) ts += getAgentScore(a.id, t);
    ts /= taskTypes.length;
    const expBonus = taskTypes.reduce((s, t) => s + (memory.performanceLog?.[a.id]?.[t]?.count || 0), 0) < 3 ? 15 : 0;
    const failPen = getRecentFailures(a.id) * 10;
    return { agent: a, score: ts + expBonus - failPen };
  }).sort((a, b) => b.score - a.score);
  return scored[0].agent;
}

// ─── Agent Greetings ───────────────────────────────────────────
const GREETINGS = {
  'mistral': 'Bonjour! Ready to code.',
  'kimi': 'Hello! Let\'s build something great.',
  'groq-llama': 'Fast and ready. What\'s the task?',
  'glm5': 'Initialized. Awaiting instructions.',
  'gpt4': 'GPT-4 online. Ready for complex tasks.',
  'grok': 'Let\'s think through this.',
  'claude': 'Ready to review and build.',
  'antigravity': 'Gemini here. Let\'s go.',
  'ollama-local': 'Local model ready.',
};

// ─── Main CLI ──────────────────────────────────────────────────
async function main() {
  loadMemory();
  loadSkills();

  const allAgents = loadAgents();
  const onlineAgents = allAgents.filter(a => a.online);
  let selectedAgentIds = []; // empty = auto

  // Spawn agents with greetings
  print(`  ${C.bold}Spawning agents...${C.reset}`);
  for (const agent of onlineAgents) {
    const greeting = GREETINGS[agent.id] || 'Online and ready.';
    await typeText(`  ${C.green}>>${C.reset} ${C.bold}${agent.name}${C.reset} is online.`, 4);
    print(`     ${C.dim}"${greeting}"${C.reset}`);
  }
  print('');
  print(`  ${C.dim}Commands: /agents  /select  /memory  /leaderboard  /quit${C.reset}`);
  print('');

  // Interactive prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${C.cyan}AgentOS${C.reset} ${C.dim}>${C.reset} `,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // Handle commands
    if (input === '/quit' || input === '/exit') {
      print(`\n  ${C.dim}Goodbye!${C.reset}\n`);
      process.exit(0);
    }

    if (input === '/agents') {
      print('');
      for (const a of allAgents) {
        const icon = a.online ? `${C.green}●${C.reset}` : `${C.dim}○${C.reset}`;
        const score = getAgentOverallScore(a.id);
        print(`  ${icon} ${a.name.padEnd(28)} score: ${score}/100`);
      }
      print('');
      rl.prompt();
      return;
    }

    if (input === '/select') {
      print('');
      print(`  ${C.bold}Select agents (enter numbers, comma-separated, or "all"):${C.reset}`);
      onlineAgents.forEach((a, i) => {
        const selected = selectedAgentIds.includes(a.id) ? `${C.green} [selected]${C.reset}` : '';
        print(`    ${C.cyan}${i + 1}${C.reset}. ${a.name}${selected}`);
      });
      print(`    ${C.cyan}0${C.reset}. Auto (smart pick)`);
      print('');

      const answer = await new Promise(resolve => {
        rl.question(`  ${C.cyan}>${C.reset} `, resolve);
      });

      if (answer.trim() === '0' || answer.trim().toLowerCase() === 'auto') {
        selectedAgentIds = [];
        print(`  ${C.green}Auto mode — smart agent selection${C.reset}`);
      } else if (answer.trim().toLowerCase() === 'all') {
        selectedAgentIds = onlineAgents.map(a => a.id);
        print(`  ${C.green}All ${onlineAgents.length} agents selected${C.reset}`);
      } else {
        const nums = answer.split(',').map(n => parseInt(n.trim()) - 1).filter(n => n >= 0 && n < onlineAgents.length);
        selectedAgentIds = nums.map(n => onlineAgents[n].id);
        const names = nums.map(n => onlineAgents[n].name);
        print(`  ${C.green}Selected: ${names.join(', ')}${C.reset}`);
      }
      print('');
      rl.prompt();
      return;
    }

    if (input === '/memory') {
      const count = Object.keys(memory.taskHistory).length;
      print(`\n  ${C.bold}Shared Memory: ${count} tasks remembered${C.reset}`);
      const recent = Object.entries(memory.taskHistory)
        .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
        .slice(0, 5);
      for (const [id, e] of recent) {
        print(`  ${C.dim}${id}${C.reset} [${e.agentName}] "${e.title}" — ${(e.files || []).length} files`);
      }
      print('');
      rl.prompt();
      return;
    }

    if (input === '/leaderboard') {
      print('');
      const ids = Object.keys(memory.performanceLog || {});
      if (ids.length === 0) { print(`  ${C.dim}No performance data yet.${C.reset}`); }
      else {
        const board = ids.map(id => ({
          name: allAgents.find(a => a.id === id)?.name || id,
          score: getAgentOverallScore(id),
        })).sort((a, b) => b.score - a.score);
        for (const e of board) {
          const filled = Math.round(e.score / 5);
          const bar = `${C.green}${'█'.repeat(filled)}${C.dim}${'░'.repeat(20 - filled)}${C.reset}`;
          print(`  ${e.name.padEnd(28)} ${bar} ${e.score}/100`);
        }
      }
      print('');
      rl.prompt();
      return;
    }

    // It's a task — dispatch to agents
    const taskTitle = input;
    const taskDesc = input;
    const taskTypes = classifyTask(taskTitle, taskDesc);

    let agentsToUse;
    if (selectedAgentIds.length > 0) {
      agentsToUse = onlineAgents.filter(a => selectedAgentIds.includes(a.id));
    } else {
      const best = pickAgent(onlineAgents, taskTitle, taskDesc);
      agentsToUse = best ? [best] : [];
    }

    if (agentsToUse.length === 0) {
      print(`  ${C.red}No agents available!${C.reset}`);
      rl.prompt();
      return;
    }

    print('');
    print(`  ${C.dim}Dispatching to: ${agentsToUse.map(a => a.name).join(', ')}${C.reset}`);
    print(`  ${C.dim}Task types: [${taskTypes.join(', ')}]${C.reset}`);
    print('');

    let totalFiles = 0;
    let totalCommands = 0;
    let totalSubtasks = 0;

    const taskId = `CLI-${Date.now()}`;

    // Run all agents in parallel, print results as they complete
    const promises = agentsToUse.map(async (agent) => {
      const startTime = Date.now();
      const header = `  ${C.cyan}── ${agent.name} (${agent.model}) ──${C.reset}`;

      try {
        process.stdout.write(`  ${C.yellow}⟳${C.reset} ${agent.name} working...\r`);
        const result = await callModel(agent, taskDesc);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const files = parseFiles(result.output);
        const execBlocks = parseExecBlocks(result.output);
        const subtasks = parseSubtasks(result.output);

        // Clear the "working" line
        process.stdout.write('\x1b[2K\r');
        print(header);

        // Write files
        if (files.length > 0) {
          const written = await writeFiles(files);
          for (const f of written) {
            print(`  ${C.green}  [file]${C.reset} ${f}`);
          }
          totalFiles += written.length;
        }

        // Run exec blocks
        let execResults = null;
        if (execBlocks.length > 0) {
          execResults = await runExecBlocks(execBlocks);
          for (const r of execResults) {
            const icon = r.success ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
            print(`  ${icon} ${C.dim}[exec]${C.reset} ${r.cmd} ${C.dim}(in ${r.cwd})${C.reset}`);
          }
          totalCommands += execBlocks.length;
        }

        // Show subtasks
        if (subtasks.length > 0) {
          for (const sub of subtasks) {
            print(`  ${C.magenta}  [subtask]${C.reset} "${sub.title}" → ${sub.agent}`);
          }
          totalSubtasks += subtasks.length;
        }

        // Show explanation (non-file text, trimmed)
        const explanation = result.output
          .replace(/===FILE===[\s\S]*?===END_FILE===/g, '')
          .replace(/===EXEC===[\s\S]*?===END_EXEC===/g, '')
          .replace(/===SUBTASK===[\s\S]*?===END_SUBTASK===/g, '')
          .replace(/\n{3,}/g, '\n\n').trim();
        if (explanation.length > 0 && explanation.length < 500) {
          print(`  ${C.dim}${explanation}${C.reset}`);
        }

        // RL scoring
        const perfScore = scoreOutput(files, execBlocks, execResults, result.tokensUsed, false);
        recordPerformance(agent.id, taskTypes, perfScore, taskId);

        print(`  ${C.dim}Done (${result.tokensUsed} tokens, ${elapsed}s, score: ${perfScore}/100)${C.reset}`);
        print('');

        // Save to memory
        memory.taskHistory[taskId + '-' + agent.id] = {
          title: taskTitle, agent: agent.id, agentName: agent.name,
          model: agent.model, output: explanation.slice(0, 500),
          files: files.map(f => f.path), tokensUsed: result.tokensUsed,
          success: true, timestamp: Date.now(),
        };
        saveMemory();
        appendHistory(`[${agent.name}] completed "${taskTitle}" (${result.tokensUsed} tokens, ${files.length} files)`);

        // Dispatch subtasks
        if (subtasks.length > 0) {
          for (const sub of subtasks) {
            print(`  ${C.magenta}Auto-dispatching subtask:${C.reset} "${sub.title}"`);
            const subAgent = pickAgent(onlineAgents, sub.title, sub.description);
            if (subAgent) {
              print(`  ${C.dim}→ ${subAgent.name}${C.reset}`);
              try {
                const subResult = await callModel(subAgent, sub.description);
                const subFiles = parseFiles(subResult.output);
                if (subFiles.length > 0) {
                  const written = await writeFiles(subFiles);
                  for (const f of written) print(`  ${C.green}  [file]${C.reset} ${f}`);
                  totalFiles += written.length;
                }
                const subScore = scoreOutput(subFiles, [], null, subResult.tokensUsed, false);
                recordPerformance(subAgent.id, classifyTask(sub.title, sub.description), subScore, taskId + '-sub');
                print(`  ${C.dim}Subtask done (${subResult.tokensUsed} tokens, score: ${subScore}/100)${C.reset}`);
              } catch (err) {
                print(`  ${C.red}Subtask failed: ${err.message}${C.reset}`);
              }
            }
          }
        }

      } catch (err) {
        process.stdout.write('\x1b[2K\r');
        print(header);
        print(`  ${C.red}  FAILED: ${err.message}${C.reset}`);
        const isApiErr = err.status === 400 || err.status === 500 || err.status === 502;
        recordPerformance(agent.id, taskTypes, isApiErr ? 25 : 0, taskId);
        print('');
      }
    });

    await Promise.all(promises);

    // Summary
    if (totalFiles > 0 || totalCommands > 0 || totalSubtasks > 0) {
      const parts = [];
      if (totalFiles > 0) parts.push(`${totalFiles} file${totalFiles > 1 ? 's' : ''}`);
      if (totalCommands > 0) parts.push(`${totalCommands} command${totalCommands > 1 ? 's' : ''}`);
      if (totalSubtasks > 0) parts.push(`${totalSubtasks} subtask${totalSubtasks > 1 ? 's' : ''}`);
      print(`  ${C.bold}Total: ${parts.join(' | ')}${C.reset}`);
      print('');
    }

    rl.prompt();
  });

  rl.on('close', () => {
    print(`\n  ${C.dim}Goodbye!${C.reset}\n`);
    process.exit(0);
  });
}

main().catch(err => {
  console.error(`\n  ${C.red}Fatal: ${err.message}${C.reset}`);
  process.exit(1);
});
