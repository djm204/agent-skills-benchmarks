#!/usr/bin/env node

/**
 * Seed script: migrates existing JSON results from results/ directory into SQLite.
 * Safe to run multiple times — skips if data already exists.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getDb,
  createRun,
  updateRunStatus,
  insertSkillResult,
  insertTestCases,
  insertSkillsWithoutTests,
} from './db.js';
import { calculateEffectivenessScore } from './reporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.resolve(__dirname, '../results');

function seed() {
  const db = getDb();

  const existing = db.prepare('SELECT COUNT(*) as count FROM benchmark_runs').get();
  if (existing.count > 0) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  const summaryPath = path.join(RESULTS_DIR, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.log('No results/summary.json found. Nothing to seed.');
    return;
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const { metadata } = summary;

  const runId = createRun({
    provider: metadata.provider,
    model: metadata.model,
    tier: metadata.tier,
    runsPerCase: metadata.runs,
  });

  const dirs = fs.readdirSync(RESULTS_DIR, { withFileTypes: true });
  let seeded = 0;

  const seedAll = db.transaction(() => {
    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;
      const resultPath = path.join(RESULTS_DIR, entry.name, 'result.json');
      if (!fs.existsSync(resultPath)) continue;

      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      const score = result.effectivenessScore || calculateEffectivenessScore(result);
      const summaryEntry = summary.results.find((r) => r.skill === result.skill);

      const skillResultId = insertSkillResult(runId, {
        skill: result.skill,
        category: summaryEntry?.category || 'other',
        baselinePassRate: result.summary.baselinePassRate,
        withSkillPassRate: result.summary.withSkillPassRate,
        avgDelta: result.summary.avgDelta,
        totalCases: result.summary.totalCases,
        runsPerCase: result.metadata?.runs || 1,
        durationMs: result.metadata?.durationMs || 0,
        tier: result.metadata?.tier || 'standard',
        scoreTotal: score.total,
        scoreAbsolute: score.absolute,
        scoreImprovement: score.improvement,
        scoreConsistency: score.consistency,
      });

      if (result.cases) {
        insertTestCases(
          skillResultId,
          result.cases.map((c) => ({
            caseId: c.id,
            prompt: c.prompt,
            baselineScore: c.baseline.score,
            baselinePassed: c.baseline.passed,
            baselineFailures: c.baseline.failures,
            baselineResponse: c.baseline.response,
            withSkillScore: c.withSkill.score,
            withSkillPassed: c.withSkill.passed,
            withSkillFailures: c.withSkill.failures,
            withSkillResponse: c.withSkill.response,
            delta: c.delta,
          }))
        );
      }

      seeded++;
    }

    if (summary.skillsWithoutTests) {
      insertSkillsWithoutTests(runId, summary.skillsWithoutTests);
    }

    updateRunStatus(runId, {
      status: 'completed',
      totalDurationMs: metadata.totalDurationMs,
      skillsBenchmarked: metadata.skillsBenchmarked,
      skillsSkipped: metadata.skillsSkipped,
      skillsErrored: metadata.skillsErrored || 0,
    });
  });

  seedAll();
  console.log(`Seeded ${seeded} skill result(s) into database.`);
}

seed();
