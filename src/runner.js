import path from 'path';
import { loadSkill, loadTestSuite, runBenchmark } from '@djm204/agent-skills/api';
import { SKILLS_DIR, ALL_SKILLS, SKILLS_WITHOUT_TESTS } from './config.js';
import { printSkillProgress, timestamp } from './utils.js';
import chalk from 'chalk';

/**
 * Run benchmarks for the specified skills (or all testable skills).
 *
 * @param {Function} provider - LLM provider function (prompt, systemPrompt?) => string
 * @param {object} options
 * @param {string} [options.skill] - Single skill name to benchmark
 * @param {number} [options.runs] - Runs per test case
 * @param {string} [options.tier] - Skill tier
 * @returns {Promise<{ results: object[], skipped: string[], metadata: object }>}
 */
export async function runAllBenchmarks(provider, options = {}) {
  const { skill: singleSkill, runs = 1, tier = 'standard' } = options;

  // Determine which skills to benchmark
  let skillNames;
  if (singleSkill) {
    if (!ALL_SKILLS.includes(singleSkill)) {
      throw new Error(`Unknown skill "${singleSkill}". Use --list-skills to see available skills.`);
    }
    if (SKILLS_WITHOUT_TESTS.includes(singleSkill)) {
      throw new Error(`Skill "${singleSkill}" has no test suite and cannot be benchmarked.`);
    }
    skillNames = [singleSkill];
  } else {
    skillNames = ALL_SKILLS.filter((s) => !SKILLS_WITHOUT_TESTS.includes(s));
  }

  const total = skillNames.length;
  const results = [];
  const errors = [];
  const startTime = Date.now();

  console.log(chalk.bold(`\nRunning benchmarks for ${total} skill(s)...\n`));

  for (let i = 0; i < total; i++) {
    const skillName = skillNames[i];
    const skillPath = path.join(SKILLS_DIR, skillName);
    const skillStartTime = Date.now();

    try {
      const skill = await loadSkill(skillPath, { tier });
      const suite = loadTestSuite(skillPath);

      if (!suite || !suite.cases || suite.cases.length === 0) {
        console.log(
          `  [${i + 1}/${total}] ${skillName.padEnd(28)} ${chalk.yellow('SKIPPED')} (no test cases)`
        );
        continue;
      }

      const result = await runBenchmark(suite, skill.systemPrompt, provider, { runs });
      const durationMs = Date.now() - skillStartTime;

      // Augment with metadata
      const augmented = {
        ...result,
        metadata: {
          tier: skill.tierUsed,
          provider: provider.providerName,
          model: provider.modelId,
          runs,
          durationMs,
          timestamp: timestamp(),
          testCaseCount: suite.cases.length,
        },
      };

      results.push(augmented);
      printSkillProgress(i, total, skillName, result);
    } catch (err) {
      const durationMs = Date.now() - skillStartTime;
      console.log(
        `  [${i + 1}/${total}] ${skillName.padEnd(28)} ${chalk.red('ERROR')} ${err.message}`
      );
      errors.push({ skill: skillName, error: err.message, durationMs });
    }
  }

  const totalDurationMs = Date.now() - startTime;

  console.log(
    chalk.bold(`\nCompleted in ${Math.round(totalDurationMs / 1000)}s`)
  );

  if (errors.length > 0) {
    console.log(chalk.red(`  ${errors.length} skill(s) had errors`));
  }

  return {
    results,
    skipped: SKILLS_WITHOUT_TESTS,
    errors,
    metadata: {
      provider: provider.providerName,
      model: provider.modelId,
      tier,
      runs,
      totalDurationMs,
      timestamp: timestamp(),
      skillsBenchmarked: results.length,
      skillsSkipped: SKILLS_WITHOUT_TESTS.length,
      skillsErrored: errors.length,
    },
  };
}
