#!/usr/bin/env node

import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';
import { getProvider, listProviders } from './providers/index.js';
import { runAllBenchmarks } from './runner.js';
import { writeResults } from './reporter.js';
import { discoverSkills, DEFAULT_OUTPUT_DIR, DEFAULT_TIER, DEFAULT_RUNS } from './config.js';
import { formatDuration } from './utils.js';

program
  .name('benchmark')
  .description('Benchmark @djm204/agent-skills effectiveness via A/B testing against bare LLM output')
  .option('-p, --provider <name>', 'LLM provider (anthropic|openai|google|mistral|groq)')
  .option('-m, --model <id>', 'Override default model for the provider')
  .option('-s, --skill <name>', 'Benchmark a single skill (default: all testable skills)')
  .option('-r, --runs <n>', 'Number of runs per test case', parseInt, DEFAULT_RUNS)
  .option('-t, --tier <tier>', 'Skill tier: minimal|standard|comprehensive', DEFAULT_TIER)
  .option('-o, --output <dir>', 'Output directory for results', DEFAULT_OUTPUT_DIR)
  .option('--list-providers', 'Show available LLM providers and exit')
  .option('--list-skills', 'Show testable skills and exit')
  .parse();

const opts = program.opts();

// Main entry — all commands run through here (async for dynamic discovery)
async function main() {
  // --list-providers
  if (opts.listProviders) {
    console.log(chalk.bold('\nAvailable LLM Providers:\n'));
    for (const p of listProviders()) {
      const status = p.available
        ? chalk.green('available')
        : chalk.gray(`not set (${p.envKey})`);
      console.log(`  ${p.name.padEnd(12)} ${p.displayName.padEnd(20)} model: ${p.defaultModel.padEnd(28)} ${status}`);
    }
    console.log();
    return;
  }

  // --list-skills (dynamically discovered from installed package)
  if (opts.listSkills) {
    const { testableSkills, skillsWithoutTests } = await discoverSkills();
    console.log(chalk.bold(`\nTestable Skills (${testableSkills.length}):\n`));
    for (const s of testableSkills) {
      console.log(`  ${s}`);
    }
    console.log(chalk.bold(`\nSkills Without Test Suites (${skillsWithoutTests.length}):\n`));
    for (const s of skillsWithoutTests) {
      console.log(`  ${chalk.gray(s)}`);
    }
    console.log();
    return;
  }
  console.log(chalk.bold.cyan('\n  Agent Skills Benchmark Suite\n'));

  // Resolve provider
  let provider;
  try {
    provider = getProvider(opts.provider, { model: opts.model });
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }

  console.log(`  Provider:  ${chalk.bold(provider.providerName)}`);
  console.log(`  Model:     ${chalk.bold(provider.modelId)}`);
  console.log(`  Tier:      ${opts.tier}`);
  console.log(`  Runs:      ${opts.runs}`);
  console.log(`  Output:    ${opts.output}`);

  if (opts.skill) {
    console.log(`  Skill:     ${opts.skill}`);
  }

  // Run benchmarks
  const startTime = Date.now();
  let benchmarkOutput;

  try {
    benchmarkOutput = await runAllBenchmarks(provider, {
      skill: opts.skill,
      runs: opts.runs,
      tier: opts.tier,
    });
  } catch (err) {
    console.error(chalk.red(`\nBenchmark failed: ${err.message}`));
    process.exit(1);
  }

  // Write results
  const output = writeResults(benchmarkOutput, opts.output);
  const totalDuration = Date.now() - startTime;

  // Summary
  console.log(chalk.bold.green(`\n  Results saved to ${opts.output}/`));
  console.log(`  ${output.skillCount} skills benchmarked in ${formatDuration(totalDuration)}`);
  console.log(`  Summary:   ${output.summaryPath}`);
  console.log(`  Report:    ${output.readmePath}\n`);
}

main().catch((err) => {
  console.error(chalk.red(err.stack || err.message));
  process.exit(1);
});
