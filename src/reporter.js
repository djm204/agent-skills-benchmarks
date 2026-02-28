import fs from 'fs';
import path from 'path';
import { SKILL_CATEGORIES, SKILLS_WITHOUT_TESTS } from './config.js';
import { formatPercent, formatDelta, stddev, clamp } from './utils.js';

/**
 * Calculate effectiveness score (0-10) for a benchmark result.
 *
 * Formula:
 *   - Absolute performance with skill (50% weight → 0-5 points)
 *   - Improvement over baseline (30% weight → 0-3 points)
 *   - Consistency across cases (20% weight → 0-2 points)
 */
export function calculateEffectivenessScore(result) {
  const { baselinePassRate, withSkillPassRate, avgDelta } = result.summary;
  const deltas = result.cases.map((c) => c.delta);

  // Component 1: Absolute skill performance (0-5)
  const absoluteScore = withSkillPassRate * 5;

  // Component 2: Improvement over baseline (0-3)
  const improvementScore = clamp(avgDelta, 0, 1) * 3;

  // Component 3: Consistency bonus (0-2)
  // Low stddev across case deltas = more consistent = higher score
  const deltaStddev = stddev(deltas);
  const consistencyScore = clamp(1 - deltaStddev, 0, 1) * 2;

  const total = Math.round((absoluteScore + improvementScore + consistencyScore) * 10) / 10;

  return {
    total: Math.min(total, 10),
    absolute: Math.round(absoluteScore * 10) / 10,
    improvement: Math.round(improvementScore * 10) / 10,
    consistency: Math.round(consistencyScore * 10) / 10,
  };
}

/**
 * Generate analysis text based on benchmark results.
 */
function generateAnalysis(result, score) {
  const lines = [];
  const { baselinePassRate, withSkillPassRate, avgDelta, totalCases } = result.summary;

  // Overall assessment
  if (score.total >= 8) {
    lines.push(`The **${result.skill}** skill demonstrates strong effectiveness with a score of ${score.total}/10.`);
  } else if (score.total >= 6) {
    lines.push(`The **${result.skill}** skill shows moderate effectiveness with a score of ${score.total}/10.`);
  } else if (score.total >= 4) {
    lines.push(`The **${result.skill}** skill shows limited effectiveness with a score of ${score.total}/10.`);
  } else {
    lines.push(`The **${result.skill}** skill shows minimal measurable effectiveness with a score of ${score.total}/10.`);
  }

  // Delta analysis
  if (avgDelta > 0.2) {
    lines.push(`The skill provides a substantial improvement (+${formatDelta(avgDelta)}) over the bare model baseline.`);
  } else if (avgDelta > 0.05) {
    lines.push(`The skill provides a modest improvement (+${formatDelta(avgDelta)}) over baseline.`);
  } else if (avgDelta > -0.05) {
    lines.push(`The skill performs similarly to the bare model (delta: ${formatDelta(avgDelta)}), suggesting the baseline model already handles these tasks reasonably well.`);
  } else {
    lines.push(`The skill actually performs slightly worse than the bare model (delta: ${formatDelta(avgDelta)}). This may indicate the system prompt constrains the model in ways that don't align with the test assertions.`);
  }

  // Baseline context
  if (baselinePassRate > 0.8) {
    lines.push(`The baseline already passes ${formatPercent(baselinePassRate)} of cases, leaving limited room for improvement.`);
  } else if (baselinePassRate < 0.3) {
    lines.push(`The baseline only passes ${formatPercent(baselinePassRate)} of cases, indicating these are challenging tasks where skill guidance is most valuable.`);
  }

  // Identify best/worst cases
  const improved = result.cases.filter((c) => c.delta > 0.1);
  const regressed = result.cases.filter((c) => c.delta < -0.1);

  if (improved.length > 0) {
    const best = improved.sort((a, b) => b.delta - a.delta)[0];
    lines.push(`Largest improvement seen in "${best.id}" (delta: ${formatDelta(best.delta)}).`);
  }

  if (regressed.length > 0) {
    lines.push(`${regressed.length} case(s) showed regression with the skill applied.`);
  }

  return lines.join(' ');
}

/**
 * Generate per-skill README content.
 */
function generateSkillReadme(result, score) {
  const { metadata } = result;
  const { summary } = result;

  let md = `# Benchmark: ${result.skill}\n\n`;

  // Summary table
  md += `## Summary\n\n`;
  md += `| Detail | Value |\n|--------|-------|\n`;
  md += `| Provider | ${metadata.provider} |\n`;
  md += `| Model | ${metadata.model} |\n`;
  md += `| Tier | ${metadata.tier} |\n`;
  md += `| Date | ${metadata.timestamp.split('T')[0]} |\n`;
  md += `| Runs per case | ${metadata.runs} |\n`;
  md += `| Duration | ${Math.round(metadata.durationMs / 1000)}s |\n\n`;

  // Results
  md += `## Results\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Baseline Pass Rate | ${formatPercent(summary.baselinePassRate)} |\n`;
  md += `| With Skill Pass Rate | ${formatPercent(summary.withSkillPassRate)} |\n`;
  md += `| Delta (avg) | ${formatDelta(summary.avgDelta)} |\n`;
  md += `| Total Cases | ${summary.totalCases} |\n`;
  md += `| **Effectiveness Score** | **${score.total} / 10** |\n\n`;

  // Score breakdown
  md += `## Effectiveness Score Breakdown\n\n`;
  md += `| Component | Score | Max | Description |\n`;
  md += `|-----------|-------|-----|-------------|\n`;
  md += `| Absolute performance | ${score.absolute} | 5.0 | How well the skill-prompted model passes test assertions |\n`;
  md += `| Improvement over baseline | ${score.improvement} | 3.0 | Delta between skill-prompted and bare model |\n`;
  md += `| Consistency | ${score.consistency} | 2.0 | Low variance across test cases |\n\n`;

  // Test case details
  md += `## Test Case Details\n\n`;
  md += `| Case | Baseline | With Skill | Delta | Status |\n`;
  md += `|------|----------|------------|-------|--------|\n`;

  for (const c of result.cases) {
    let status;
    if (c.delta > 0.1) status = 'improved';
    else if (c.delta < -0.1) status = 'regressed';
    else if (c.withSkill.passed) status = 'passed (no change)';
    else status = 'failed (no change)';

    md += `| ${c.id} | ${c.baseline.score.toFixed(2)} | ${c.withSkill.score.toFixed(2)} | ${formatDelta(c.delta)} | ${status} |\n`;
  }

  md += `\n`;

  // Failures detail
  const failedCases = result.cases.filter((c) => c.withSkill.failures.length > 0);
  if (failedCases.length > 0) {
    md += `## Failures Detail\n\n`;
    for (const c of failedCases) {
      md += `### ${c.id}\n`;
      for (const f of c.withSkill.failures) {
        md += `- ${f}\n`;
      }
      md += `\n`;
    }
  }

  // Analysis
  md += `## Analysis\n\n`;
  md += generateAnalysis(result, score) + '\n';

  return md;
}

/**
 * Generate master README content.
 */
function generateMasterReadme(allResults, metadata) {
  const scored = allResults.map((r) => ({
    result: r,
    score: calculateEffectivenessScore(r),
  }));

  // Sort by effectiveness score (descending)
  scored.sort((a, b) => b.score.total - a.score.total);

  const scores = scored.map((s) => s.score.total);
  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0;
  const medianScore = scores.length > 0
    ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
    : 0;

  let md = `# Agent Skills Benchmark Results\n\n`;
  md += `Automated A/B benchmark comparing LLM responses **with** vs **without** agent skill system prompts.\n\n`;

  // Run metadata
  md += `## Run Configuration\n\n`;
  md += `| Detail | Value |\n|--------|-------|\n`;
  md += `| Provider | ${metadata.provider} |\n`;
  md += `| Model | ${metadata.model} |\n`;
  md += `| Tier | ${metadata.tier} |\n`;
  md += `| Runs per case | ${metadata.runs} |\n`;
  md += `| Date | ${metadata.timestamp.split('T')[0]} |\n`;
  md += `| Total duration | ${Math.round(metadata.totalDurationMs / 1000)}s |\n`;
  md += `| Skills benchmarked | ${metadata.skillsBenchmarked} |\n`;
  md += `| Skills skipped (no tests) | ${metadata.skillsSkipped} |\n\n`;

  // Aggregate stats
  md += `## Aggregate Statistics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Average Effectiveness Score | ${avgScore} / 10 |\n`;
  md += `| Median Effectiveness Score | ${medianScore} / 10 |\n`;
  md += `| Best | ${scored[0]?.result.skill || 'N/A'} (${scored[0]?.score.total || 0}/10) |\n`;
  md += `| Worst | ${scored[scored.length - 1]?.result.skill || 'N/A'} (${scored[scored.length - 1]?.score.total || 0}/10) |\n\n`;

  // Scoring methodology
  md += `## Scoring Methodology\n\n`;
  md += `Each skill receives an effectiveness score out of 10, composed of:\n\n`;
  md += `| Component | Weight | Description |\n`;
  md += `|-----------|--------|-------------|\n`;
  md += `| Absolute performance | 5 pts | Pass rate of skill-prompted responses against test assertions |\n`;
  md += `| Improvement over baseline | 3 pts | How much better the skill performs vs. the bare model (clamped 0-1) |\n`;
  md += `| Consistency | 2 pts | Low variance in per-case deltas (reliable improvement) |\n\n`;
  md += `Test assertions are deterministic string checks (contains, not_contains, length bounds) — no subjective LLM-as-judge scoring.\n\n`;

  // Results by category
  const categories = {};
  for (const { result, score } of scored) {
    const cat = SKILL_CATEGORIES[result.skill] || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ result, score });
  }

  md += `## Results by Category\n\n`;

  for (const [category, skills] of Object.entries(categories).sort()) {
    md += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    md += `| Skill | Baseline | With Skill | Delta | Score |\n`;
    md += `|-------|----------|------------|-------|-------|\n`;

    for (const { result, score } of skills) {
      const s = result.summary;
      md += `| [${result.skill}](./${result.skill}/README.md) | ${formatPercent(s.baselinePassRate)} | ${formatPercent(s.withSkillPassRate)} | ${formatDelta(s.avgDelta)} | **${score.total}/10** |\n`;
    }

    md += `\n`;
  }

  // Full ranking
  md += `## Full Ranking\n\n`;
  md += `| Rank | Skill | Category | Baseline | With Skill | Delta | Score |\n`;
  md += `|------|-------|----------|----------|------------|-------|-------|\n`;

  scored.forEach(({ result, score }, i) => {
    const s = result.summary;
    const cat = SKILL_CATEGORIES[result.skill] || 'other';
    md += `| ${i + 1} | [${result.skill}](./${result.skill}/README.md) | ${cat} | ${formatPercent(s.baselinePassRate)} | ${formatPercent(s.withSkillPassRate)} | ${formatDelta(s.avgDelta)} | **${score.total}/10** |\n`;
  });

  md += `\n`;

  // Skills without tests
  md += `## Skills Without Test Suites\n\n`;
  md += `The following ${SKILLS_WITHOUT_TESTS.length} skills have no test suite and could not be benchmarked:\n\n`;
  for (const s of SKILLS_WITHOUT_TESTS) {
    md += `- ${s}\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `*Generated by [agent-skills-benchmarks](https://github.com/djm204/agent-skills) — results are deterministic assertion checks, not subjective evaluations.*\n`;

  return md;
}

/**
 * Write all benchmark results to the output directory.
 */
export function writeResults(benchmarkOutput, outputDir) {
  const { results, metadata } = benchmarkOutput;

  // Ensure output dir exists
  fs.mkdirSync(outputDir, { recursive: true });

  const scoredResults = [];

  // Write per-skill results
  for (const result of results) {
    const skillDir = path.join(outputDir, result.skill);
    fs.mkdirSync(skillDir, { recursive: true });

    const score = calculateEffectivenessScore(result);
    scoredResults.push({ ...result, effectivenessScore: score });

    // Write raw JSON
    const jsonResult = {
      ...result,
      effectivenessScore: score,
    };
    // Don't include the full system prompt in JSON output (too large)
    delete jsonResult.systemPrompt;

    fs.writeFileSync(
      path.join(skillDir, 'result.json'),
      JSON.stringify(jsonResult, null, 2) + '\n'
    );

    // Write skill README
    fs.writeFileSync(
      path.join(skillDir, 'README.md'),
      generateSkillReadme(result, score)
    );
  }

  // Write summary JSON
  const summary = {
    metadata,
    results: scoredResults.map((r) => ({
      skill: r.skill,
      category: SKILL_CATEGORIES[r.skill] || 'other',
      baselinePassRate: r.summary.baselinePassRate,
      withSkillPassRate: r.summary.withSkillPassRate,
      avgDelta: r.summary.avgDelta,
      totalCases: r.summary.totalCases,
      effectivenessScore: r.effectivenessScore,
    })),
    skillsWithoutTests: SKILLS_WITHOUT_TESTS,
  };

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n'
  );

  // Write master README
  fs.writeFileSync(
    path.join(outputDir, 'README.md'),
    generateMasterReadme(results, metadata)
  );

  return {
    skillCount: results.length,
    outputDir,
    summaryPath: path.join(outputDir, 'summary.json'),
    readmePath: path.join(outputDir, 'README.md'),
  };
}
