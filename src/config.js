import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to installed skills directory inside node_modules */
export const SKILLS_DIR = path.resolve(
  __dirname,
  '../node_modules/@djm204/agent-skills/skills'
);

/** All 44 skills in the package */
export const ALL_SKILLS = [
  'blockchain',
  'brand-guardian',
  'cli-tools',
  'content-creation-expert',
  'cpp-expert',
  'csharp-expert',
  'data-engineering',
  'devops-sre',
  'documentation',
  'educator',
  'executive-assistant',
  'fullstack',
  'golang-expert',
  'grant-writer',
  'java-expert',
  'javascript-expert',
  'knowledge-synthesis',
  'kotlin-expert',
  'market-intelligence',
  'marketing-expert',
  'ml-ai',
  'mobile',
  'platform-engineering',
  'predictive-maintenance',
  'product-manager',
  'project-manager',
  'python-expert',
  'qa-engineering',
  'regulatory-sentinel',
  'research-assistant',
  'resource-allocator',
  'ruby-expert',
  'rust-expert',
  'social-media-expert',
  'strategic-negotiator',
  'supply-chain',
  'supply-chain-harmonizer',
  'swift-expert',
  'testing',
  'unity-dev-expert',
  'utility-agent',
  'ux-designer',
  'web-backend',
  'web-frontend',
];

/** Skills known to have no test suites */
export const SKILLS_WITHOUT_TESTS = [
  'blockchain',
  'devops-sre',
  'educator',
  'executive-assistant',
  'javascript-expert',
  'market-intelligence',
  'product-manager',
  'web-backend',
];

/** Category mapping for reporting */
export const SKILL_CATEGORIES = {
  'blockchain': 'engineering',
  'brand-guardian': 'creative',
  'cli-tools': 'engineering',
  'content-creation-expert': 'creative',
  'cpp-expert': 'languages',
  'csharp-expert': 'languages',
  'data-engineering': 'engineering',
  'devops-sre': 'engineering',
  'documentation': 'professional',
  'educator': 'education',
  'executive-assistant': 'professional',
  'fullstack': 'engineering',
  'golang-expert': 'languages',
  'grant-writer': 'professional',
  'java-expert': 'languages',
  'javascript-expert': 'languages',
  'knowledge-synthesis': 'professional',
  'kotlin-expert': 'languages',
  'market-intelligence': 'business',
  'marketing-expert': 'business',
  'ml-ai': 'engineering',
  'mobile': 'engineering',
  'platform-engineering': 'engineering',
  'predictive-maintenance': 'business',
  'product-manager': 'business',
  'project-manager': 'business',
  'python-expert': 'languages',
  'qa-engineering': 'engineering',
  'regulatory-sentinel': 'business',
  'research-assistant': 'professional',
  'resource-allocator': 'business',
  'ruby-expert': 'languages',
  'rust-expert': 'languages',
  'social-media-expert': 'creative',
  'strategic-negotiator': 'business',
  'supply-chain': 'business',
  'supply-chain-harmonizer': 'business',
  'swift-expert': 'languages',
  'testing': 'engineering',
  'unity-dev-expert': 'engineering',
  'utility-agent': 'agents',
  'ux-designer': 'creative',
  'web-backend': 'engineering',
  'web-frontend': 'engineering',
};

/** Default output directory */
export const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, '../results');

/** Default tier for skill loading */
export const DEFAULT_TIER = 'standard';

/** Default number of benchmark runs per test case */
export const DEFAULT_RUNS = 1;
