#!/usr/bin/env node
/**
 * Agent life simulator
 * Periodically changes presence states for all agents — simulates "living office"
 */

const http = require('http');

const BASE = 'http://localhost:3000/api/v1';
const CREDS = { email: 'smoketest@office.local', password: 'CHANGE_ME_TEST_PASSWORD' };
const ZONE_ID = 'ea997b92-107d-4c8d-998e-397080aff717';
const STATES = ['IDLE', 'WORKING', 'WORKING', 'WORKING', 'RESTING', 'SMOKING', 'CHATTING'];
const TICK_MS = 4000; // change state every 4 sec per agent, staggered

let token = null;
let agents = [];

function req(method, path, body, tok) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000,
      path: `/api/v1${path}`, method,
      headers: {
        'Content-Type': 'application/json',
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function randomState() {
  return STATES[Math.floor(Math.random() * STATES.length)];
}

async function login() {
  const data = await req('POST', '/auth/login', CREDS);
  token = data.accessToken;
  console.log('[sim] logged in, token ok');
}

async function loadAgents() {
  agents = await req('GET', '/agents', null, token);
  console.log(`[sim] loaded ${agents.length} agents:`, agents.map(a => a.name).join(', '));
}

async function setPresence(agentId, state) {
  try {
    await req('PUT', `/presence/${agentId}`, { state, zoneId: ZONE_ID }, token);
  } catch (e) {
    console.warn(`[sim] presence error for ${agentId}:`, e.message);
  }
}

async function tick(agent, index) {
  const state = randomState();
  process.stdout.write(`[sim] ${agent.name} → ${state}\n`);
  await setPresence(agent.id, state);
}

async function main() {
  await login();
  await loadAgents();

  if (agents.length === 0) {
    console.error('[sim] No agents found, exiting');
    process.exit(1);
  }

  // Set initial states
  for (const agent of agents) {
    await setPresence(agent.id, 'WORKING');
  }
  console.log('[sim] Initial states set. Starting simulation loop...\n');

  // Stagger each agent on a different interval
  agents.forEach((agent, i) => {
    setTimeout(() => {
      tick(agent, i);
      setInterval(() => tick(agent, i), TICK_MS);
    }, i * (TICK_MS / agents.length));
  });
}

main().catch((e) => {
  console.error('[sim] fatal:', e);
  process.exit(1);
});
