# Agent Skills Benchmark Suite

A/B benchmark suite for [@djm204/agent-skills](https://www.npmjs.com/package/@djm204/agent-skills) — measures skill effectiveness by comparing LLM responses **with** vs **without** skill system prompts.

## How It Works

For each of the 36 testable skills, the benchmark:

1. Sends each test case prompt to the LLM **without** a system prompt (baseline)
2. Sends the same prompt **with** the skill's system prompt applied
3. Scores both responses against deterministic assertions (contains, not_contains, length bounds)
4. Computes a delta and an overall effectiveness score (0–10)

No LLM-as-judge. No subjective evaluation. All scoring is deterministic string matching.

## Quick Start

```bash
npm install
```

Set an API key for any supported provider:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
# or
export GOOGLE_API_KEY=...
# or
export MISTRAL_API_KEY=...
# or
export GROQ_API_KEY=gsk_...
```

Run the benchmarks:

```bash
npm run benchmark
```

## CLI Options

```
Usage: benchmark [options]

Options:
  -p, --provider <name>  LLM provider (anthropic|openai|google|mistral|groq)
  -m, --model <id>       Override default model for the provider
  -s, --skill <name>     Benchmark a single skill (default: all testable skills)
  -r, --runs <n>         Number of runs per test case (default: 1)
  -t, --tier <tier>      Skill tier: minimal|standard|comprehensive (default: "standard")
  -o, --output <dir>     Output directory for results (default: "./results")
  --list-providers       Show available LLM providers and exit
  --list-skills          Show testable skills and exit
  -h, --help             Show help
```

## Examples

```bash
# Run all skills against whichever provider has an API key set
npm run benchmark

# Run with a specific provider
npm run benchmark -- --provider openai

# Benchmark a single skill
npm run benchmark -- --skill python-expert

# Use a specific model
npm run benchmark -- --provider anthropic --model claude-haiku-4-5-20251001

# Run 3 passes per test case for statistical averaging
npm run benchmark -- --runs 3

# Use comprehensive tier prompts instead of standard
npm run benchmark -- --tier comprehensive

# Custom output directory
npm run benchmark -- --output ./my-results
```

## Supported Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| Google | `GOOGLE_API_KEY` | gemini-2.0-flash |
| Mistral | `MISTRAL_API_KEY` | mistral-large-latest |
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile |

If no `--provider` flag is given, the first available API key is used (checked in the order above).

## Output

Results are written to `./results/` (configurable with `--output`):

```
results/
├── README.md              # Master report with rankings and aggregate stats
├── summary.json           # Machine-readable aggregate data
└── {skill-name}/
    ├── README.md           # Per-skill report with analysis
    └── result.json         # Raw benchmark data
```

## Effectiveness Score

Each skill receives a score out of 10:

| Component | Max Points | What It Measures |
|-----------|-----------|------------------|
| Absolute performance | 5 | Pass rate of skill-prompted responses |
| Improvement over baseline | 3 | Delta vs. bare model (clamped 0–1) |
| Consistency | 2 | Low variance across test cases |

## Coverage

36 of 44 skills have test suites and are benchmarked. The following 8 skills have no test cases and are listed as N/A in results:

blockchain, devops-sre, educator, executive-assistant, javascript-expert, market-intelligence, product-manager, web-backend
