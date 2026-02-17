#!/usr/bin/env node
/**
 * AgentOS — Entry Point
 * Run: node start.js
 * Shows banner, checks deps, validates .env, then asks user to pick mode.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgRed: '\x1b[41m',
};

function print(msg = '') { process.stdout.write(msg + '\n'); }

function banner() {
  print('');
  print(`  ${C.cyan}╔══════════════════════════════════════════════════╗${C.reset}`);
  print(`  ${C.cyan}║${C.reset}  ${C.bold}${C.white}   A G E N T   O S   v0.1.0${C.reset}                     ${C.cyan}║${C.reset}`);
  print(`  ${C.cyan}║${C.reset}  ${C.dim}   Multi-Engine AI Orchestrator${C.reset}                ${C.cyan}║${C.reset}`);
  print(`  ${C.cyan}║${C.reset}  ${C.dim}   Reinforcement Learning + Skills${C.reset}             ${C.cyan}║${C.reset}`);
  print(`  ${C.cyan}╚══════════════════════════════════════════════════╝${C.reset}`);
  print('');
}

function checkDeps() {
  process.stdout.write(`  ${C.cyan}[1/3]${C.reset} Checking dependencies... `);
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    print(`${C.yellow}installing...${C.reset}`);
    try {
      execSync('npm install', { cwd: __dirname, stdio: 'pipe', timeout: 120000 });
      print(`        ${C.green}npm install complete${C.reset}`);
    } catch (err) {
      print(`${C.red}FAILED${C.reset}`);
      print(`        ${C.red}npm install failed: ${err.message}${C.reset}`);
      process.exit(1);
    }
  } else {
    print(`${C.green}OK${C.reset}`);
  }
}

function checkEnv() {
  process.stdout.write(`  ${C.cyan}[2/3]${C.reset} Loading .env... `);

  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    print(`${C.red}NOT FOUND${C.reset}`);
    print(`        ${C.red}Create a .env file with your API keys.${C.reset}`);
    process.exit(1);
  }

  const envRaw = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};
  for (const line of envRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = value;
  }
  print(`${C.green}OK${C.reset}`);

  const agentsPath = path.join(__dirname, 'agent_os', 'agents.json');
  if (!fs.existsSync(agentsPath)) {
    print(`        ${C.red}agent_os/agents.json not found${C.reset}`);
    process.exit(1);
  }
  const agentsConfig = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
  const agents = agentsConfig.agents || [];

  let readyCount = 0;
  let offlineCount = 0;
  const agentStatuses = [];

  for (const agent of agents) {
    if (agent.provider === 'cursor-bridge' || agent.provider === 'copilot-bridge') continue;
    const keyVar = agent.apiKeyEnvVar;
    const hasKey = keyVar && envVars[keyVar] && envVars[keyVar].length > 0;
    const noKeyNeeded = !keyVar || keyVar === '';

    if (hasKey || noKeyNeeded) {
      readyCount++;
      agentStatuses.push({ name: agent.name, ready: true });
    } else {
      offlineCount++;
      agentStatuses.push({ name: agent.name, ready: false });
    }
  }

  for (const a of agentStatuses) {
    const icon = a.ready ? `${C.green}●${C.reset}` : `${C.dim}○${C.reset}`;
    const status = a.ready ? `${C.green}READY${C.reset}` : `${C.dim}NO KEY${C.reset}`;
    print(`        ${icon} ${a.name.padEnd(28)} [${status}]`);
  }

  print(`  ${C.cyan}[3/3]${C.reset} ${C.bold}${readyCount} agent${readyCount !== 1 ? 's' : ''} ready${C.reset}, ${offlineCount} offline.`);
  print('');

  return { readyCount, offlineCount };
}

// Synchronous single-line read from stdin (doesn't touch the stream state)
function readLineSync() {
  const buf = Buffer.alloc(256);
  let str = '';
  try {
    const bytesRead = fs.readSync(0, buf, 0, 256);
    str = buf.slice(0, bytesRead).toString('utf-8').trim();
  } catch (e) {
    str = '1'; // default to UI on error
  }
  return str;
}

function askMode() {
  print(`  ${C.bold}How do you want to work?${C.reset}`);
  print(`    ${C.cyan}[1]${C.reset} Dashboard  ${C.dim}— browser village at localhost:3000${C.reset}`);
  print(`    ${C.cyan}[2]${C.reset} Terminal   ${C.dim}— interactive CMD right here${C.reset}`);
  print('');
  process.stdout.write(`  ${C.cyan}>${C.reset} `);

  const choice = readLineSync();
  if (choice === '2' || choice.toLowerCase().startsWith('t') || choice.toLowerCase().startsWith('cmd')) {
    return 'cmd';
  }
  return 'ui';
}

function freePort() {
  try {
    const result = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = result.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* no process on port 3000 */ }
}

function launchUI() {
  print(`  ${C.green}Launching Dashboard mode...${C.reset}`);
  freePort();
  print(`  ${C.dim}Starting server at http://localhost:3000${C.reset}`);
  print('');
  require('./dev-server.js');
}

function launchCMD() {
  print(`  ${C.green}Launching Terminal mode...${C.reset}`);
  print('');
  // Spawn cli.js as a child process with fresh stdio so readline works
  const child = spawn('node', [path.join(__dirname, 'cli.js')], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}

function main() {
  banner();
  checkDeps();
  checkEnv();

  // Allow skipping the menu: node start.js cmd  OR  node start.js ui
  const arg = (process.argv[2] || '').toLowerCase();
  let mode;
  if (arg === 'cmd' || arg === '2' || arg === 'terminal') {
    mode = 'cmd';
  } else if (arg === 'ui' || arg === '1' || arg === 'dashboard') {
    mode = 'ui';
  } else {
    mode = askMode();
  }

  if (mode === 'cmd') {
    launchCMD();
  } else {
    launchUI();
  }
}

main();
