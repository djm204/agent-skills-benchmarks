import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listSkills, loadTestSuite } from '@djm204/agent-skills/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to installed skills directory inside node_modules */
export const SKILLS_DIR = path.resolve(
  __dirname,
  '../node_modules/@djm204/agent-skills/skills'
);

/** Default output directory */
export const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '../results');

/** Default tier for skill loading */
export const DEFAULT_TIER = 'standard';

/** Default number of benchmark runs per test case */
export const DEFAULT_RUNS = 1;

// Dynamic discovery cache (populated on first call)
let _discovered = null;

/**
 * Discover all skills from the installed package at runtime.
 * Returns skill names, categories, and which ones have test suites.
 */
export async function discoverSkills() {
  if (_discovered) return _discovered;

  const metas = await listSkills(SKILLS_DIR);

  const allSkills = [];
  const testableSkills = [];
  const skillsWithoutTests = [];
  const categories = {};

  for (const meta of metas) {
    allSkills.push(meta.name);
    categories[meta.name] = meta.category;

    const suite = loadTestSuite(meta.path);
    if (suite && suite.cases && suite.cases.length > 0) {
      testableSkills.push(meta.name);
    } else {
      skillsWithoutTests.push(meta.name);
    }
  }

  _discovered = {
    allSkills,
    testableSkills,
    skillsWithoutTests,
    categories,
  };
  return _discovered;
}
