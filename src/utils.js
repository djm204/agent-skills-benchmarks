import chalk from 'chalk';

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format a rate (0-1) as a percentage string.
 */
export function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format a delta with sign.
 */
export function formatDelta(delta) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

/**
 * Colorize a delta value for terminal output.
 */
export function colorDelta(delta) {
  const formatted = formatDelta(delta);
  if (delta > 0.1) return chalk.green(formatted);
  if (delta < -0.1) return chalk.red(formatted);
  return chalk.yellow(formatted);
}

/**
 * Standard deviation of an array of numbers.
 */
export function stddev(numbers) {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map((n) => (n - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length);
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Print a progress line for a completed skill benchmark.
 */
export function printSkillProgress(index, total, skillName, result) {
  const num = String(index + 1).padStart(String(total).length, ' ');
  const name = skillName.padEnd(28, ' ');
  const baseline = formatPercent(result.summary.baselinePassRate);
  const withSkill = formatPercent(result.summary.withSkillPassRate);
  const delta = colorDelta(result.summary.avgDelta);
  console.log(
    `  [${num}/${total}] ${name} baseline: ${baseline.padStart(6)} | skill: ${withSkill.padStart(6)} | Δ: ${delta}`
  );
}

/**
 * Get current ISO timestamp.
 */
export function timestamp() {
  return new Date().toISOString();
}
