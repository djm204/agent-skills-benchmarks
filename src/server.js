import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProvider, listProviders } from './providers/index.js';
import { runAllBenchmarks } from './runner.js';
import { writeResults, writeResultsToDb } from './reporter.js';
import { discoverSkills, DEFAULT_OUTPUT_DIR, DEFAULT_TIER } from './config.js';
import {
  getDb,
  createRun,
  updateRunStatus,
  getRunningRun,
  listRuns,
  getRun,
  getLatestSkillResults,
  getLatestSkillResult,
  getSkillResultsByRun,
  getSkillsWithoutTests,
} from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { saveCredential, deleteCredential, getCredential, listCredentials } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// SSE clients per run ID
const sseClients = new Map();

function sendSSE(runId, event, data) {
  const clients = sseClients.get(runId);
  if (!clients) return;
  for (const res of clients) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res, msg, status = 400) {
  json(res, { error: msg }, status);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function parseRoute(url) {
  const [pathname, query] = url.split('?');
  const params = new URLSearchParams(query || '');
  return { pathname, params };
}

function formatSkillResult(row) {
  if (!row) return null;
  return {
    skill: row.skill,
    category: row.category,
    summary: {
      baselinePassRate: row.baseline_pass_rate,
      withSkillPassRate: row.with_skill_pass_rate,
      avgDelta: row.avg_delta,
      totalCases: row.total_cases,
      runs: row.runs_per_case,
    },
    effectivenessScore: {
      total: row.score_total,
      absolute: row.score_absolute,
      improvement: row.score_improvement,
      consistency: row.score_consistency,
    },
    metadata: {
      tier: row.tier,
      durationMs: row.duration_ms,
      runs: row.runs_per_case,
    },
    cases: (row.cases || []).map((c) => ({
      id: c.case_id,
      prompt: c.prompt,
      baseline: {
        score: c.baseline_score,
        passed: Boolean(c.baseline_passed),
        failures: JSON.parse(c.baseline_failures || '[]'),
        response: c.baseline_response,
      },
      withSkill: {
        score: c.with_skill_score,
        passed: Boolean(c.with_skill_passed),
        failures: JSON.parse(c.with_skill_failures || '[]'),
        response: c.with_skill_response,
      },
      delta: c.delta,
    })),
  };
}

async function handleRequest(req, res) {
  const { pathname, params } = parseRoute(req.url);
  const method = req.method;

  // --- Static files ---
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/web/' });
    res.end();
    return;
  }

  if (pathname.startsWith('/web/') || pathname === '/web') {
    const rel = pathname === '/web' || pathname === '/web/'
      ? 'index.html'
      : pathname.slice(5);
    serveStatic(res, path.join(ROOT, 'web', rel));
    return;
  }

  // --- API Routes ---

  // GET /api/summary — latest results summary from DB
  if (pathname === '/api/summary' && method === 'GET') {
    const results = getLatestSkillResults();
    const skillsWithout = getSkillsWithoutTests();
    const runs = listRuns(1);
    const latestRun = runs[0];

    const summary = {
      metadata: latestRun ? {
        provider: latestRun.provider,
        model: latestRun.model,
        tier: latestRun.tier,
        runs: latestRun.runs_per_case,
        totalDurationMs: latestRun.total_duration_ms,
        timestamp: latestRun.created_at,
        skillsBenchmarked: latestRun.skills_benchmarked,
        skillsSkipped: latestRun.skills_skipped,
        skillsErrored: latestRun.skills_errored,
      } : null,
      results: results.map((r) => ({
        skill: r.skill,
        category: r.category,
        baselinePassRate: r.baseline_pass_rate,
        withSkillPassRate: r.with_skill_pass_rate,
        avgDelta: r.avg_delta,
        totalCases: r.total_cases,
        effectivenessScore: {
          total: r.score_total,
          absolute: r.score_absolute,
          improvement: r.score_improvement,
          consistency: r.score_consistency,
        },
      })),
      skillsWithoutTests: skillsWithout,
    };

    json(res, summary);
    return;
  }

  // GET /api/skills/:name — full skill result with cases
  const skillMatch = pathname.match(/^\/api\/skills\/([^/]+)$/);
  if (skillMatch && method === 'GET') {
    const skillName = decodeURIComponent(skillMatch[1]);
    const result = getLatestSkillResult(skillName);
    if (!result) return error(res, `Skill "${skillName}" not found`, 404);
    json(res, formatSkillResult(result));
    return;
  }

  // GET /api/providers — list providers with availability
  if (pathname === '/api/providers' && method === 'GET') {
    json(res, listProviders());
    return;
  }

  // GET /api/runs — benchmark run history
  if (pathname === '/api/runs' && method === 'GET') {
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');
    json(res, listRuns(limit, offset));
    return;
  }

  // GET /api/runs/:id — single run with skill results
  const runMatch = pathname.match(/^\/api\/runs\/(\d+)$/);
  if (runMatch && method === 'GET') {
    const runId = parseInt(runMatch[1]);
    const run = getRun(runId);
    if (!run) return error(res, 'Run not found', 404);
    const skillResults = getSkillResultsByRun(runId);
    json(res, { ...run, skillResults: skillResults.map(r => ({
      skill: r.skill,
      category: r.category,
      baselinePassRate: r.baseline_pass_rate,
      withSkillPassRate: r.with_skill_pass_rate,
      avgDelta: r.avg_delta,
      totalCases: r.total_cases,
      scoreTotal: r.score_total,
    }))});
    return;
  }

  // GET /api/skills-list — testable skills for the run form
  if (pathname === '/api/skills-list' && method === 'GET') {
    const { testableSkills, skillsWithoutTests } = await discoverSkills();
    json(res, { testableSkills, skillsWithoutTests });
    return;
  }

  // POST /api/credentials — save encrypted API key
  if (pathname === '/api/credentials' && method === 'POST') {
    const body = await readBody(req);
    if (!body.provider || !body.apiKey) {
      return error(res, 'provider and apiKey required');
    }
    const providers = listProviders();
    const valid = providers.find((p) => p.name === body.provider);
    if (!valid) return error(res, `Unknown provider: ${body.provider}`);

    const encrypted = encrypt(body.apiKey);
    saveCredential(body.provider, encrypted);
    // Inject into env for current session
    process.env[valid.envKey] = body.apiKey;
    json(res, { ok: true, provider: body.provider }, 201);
    return;
  }

  // DELETE /api/credentials/:provider
  const credMatch = pathname.match(/^\/api\/credentials\/([^/]+)$/);
  if (credMatch && method === 'DELETE') {
    const providerName = decodeURIComponent(credMatch[1]);
    // Get envKey before deleting so we can clean up process.env
    const envKeys = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY', mistral: 'MISTRAL_API_KEY', groq: 'GROQ_API_KEY' };
    deleteCredential(providerName);
    if (envKeys[providerName]) delete process.env[envKeys[providerName]];
    json(res, { ok: true });
    return;
  }

  // GET /api/credentials — list stored credentials (no keys returned)
  if (pathname === '/api/credentials' && method === 'GET') {
    json(res, listCredentials());
    return;
  }

  // POST /api/run — start a benchmark run
  if (pathname === '/api/run' && method === 'POST') {
    const running = getRunningRun();
    if (running) {
      return error(res, 'A benchmark run is already in progress', 409);
    }

    const body = await readBody(req);
    const providerName = body.provider;
    const model = body.model || undefined;
    const skills = body.skills || [];
    const tier = body.tier || DEFAULT_TIER;
    const runs = parseInt(body.runs) || 1;

    let provider;
    try {
      provider = getProvider(providerName, { model });
    } catch (err) {
      return error(res, err.message);
    }

    const runId = createRun({
      provider: provider.providerName,
      model: provider.modelId,
      tier,
      runsPerCase: runs,
    });

    json(res, { runId }, 202);

    // Run benchmarks async
    setImmediate(async () => {
      try {
        const benchmarkOutput = await runAllBenchmarks(provider, {
          skills: skills.length > 0 ? skills : undefined,
          runs,
          tier,
          onProgress: (event) => sendSSE(runId, event.event, event),
        });

        writeResults(benchmarkOutput, DEFAULT_OUTPUT_DIR);
        writeResultsToDb(benchmarkOutput, runId);

        sendSSE(runId, 'run:complete', {
          runId,
          skillsBenchmarked: benchmarkOutput.metadata.skillsBenchmarked,
          totalDurationMs: benchmarkOutput.metadata.totalDurationMs,
        });
      } catch (err) {
        updateRunStatus(runId, {
          status: 'failed',
          skillsBenchmarked: 0,
          skillsSkipped: 0,
          skillsErrored: 0,
        });
        sendSSE(runId, 'run:error', { error: err.message });
      } finally {
        // Close SSE connections for this run
        const clients = sseClients.get(runId);
        if (clients) {
          for (const client of clients) client.end();
          sseClients.delete(runId);
        }
      }
    });

    return;
  }

  // GET /api/run/:id/progress — SSE stream
  const progressMatch = pathname.match(/^\/api\/run\/(\d+)\/progress$/);
  if (progressMatch && method === 'GET') {
    const runId = parseInt(progressMatch[1]);
    const run = getRun(runId);
    if (!run) return error(res, 'Run not found', 404);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ runId, status: run.status })}\n\n`);

    if (run.status === 'completed' || run.status === 'failed') {
      res.write(`event: run:${run.status}\ndata: ${JSON.stringify({ runId })}\n\n`);
      res.end();
      return;
    }

    if (!sseClients.has(runId)) sseClients.set(runId, new Set());
    sseClients.get(runId).add(res);

    // Keepalive every 30s
    const keepalive = setInterval(() => res.write(': keepalive\n\n'), 30000);

    req.on('close', () => {
      clearInterval(keepalive);
      const clients = sseClients.get(runId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) sseClients.delete(runId);
      }
    });

    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

export async function startServer(port = 3000) {
  // Ensure DB is initialized
  getDb();

  const server = http.createServer((req, res) => {
    // CORS headers for localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    handleRequest(req, res).catch((err) => {
      console.error('Request error:', err);
      if (!res.headersSent) {
        error(res, 'Internal server error', 500);
      }
    });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  Benchmark Dashboard running at http://localhost:${port}/web/`);
    console.log(`  API available at http://localhost:${port}/api/`);
    console.log(`  Bound to localhost only\n`);
  });
}
