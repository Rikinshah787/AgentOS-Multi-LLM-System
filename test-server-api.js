/**
 * Quick test: dev-server must be running on http://localhost:3000
 * Run: node test-server-api.js
 */
require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const raw = JSON.stringify(body);
    const opts = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function main() {
  console.log('Testing AgentOS dev-server at', BASE, '\n');

  try {
    const state = await get('/api/state');
    const agents = state?.agents ?? [];
    const online = agents.filter((a) => a.status !== 'offline');
    console.log('GET /api/state OK —', agents.length, 'agents,', online.length, 'online');

    const task = await post('/api/task', {
      title: 'Test from test-server-api.js',
      description: 'Quick sanity check',
      agentId: 'auto',
    });
    if (task?.id) {
      console.log('POST /api/task OK — created', task.id);
    } else {
      console.log('POST /api/task response:', task);
    }
    console.log('\nAll checks passed.');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

main();
