# CLAUDE.md - Development Guide

This project uses AI-assisted development. Rules in `.cursor/rules/` provide guidance.

## Installed Templates

- **Shared** (always included): Core principles, code quality, security, git workflow, communication
- **javascript-expert**: Principal-level JavaScript & TypeScript engineering (Node.js, React, type system, testing)
- **web-backend**: Backend APIs and services (REST, GraphQL, microservices)
- **qa-engineering**: Quality assurance programs for confident, rapid software delivery
- **testing**: Comprehensive testing practices (TDD, test design, CI/CD integration, performance testing)

## Rule Files

All rules are in `.cursor/rules/`. The AI assistant reads these automatically.

#### Shared Rules

| Rule | Purpose |
|------|---------|
| `core-principles.mdc` | Honesty, simplicity, testing requirements |
| `code-quality.mdc` | SOLID, DRY, clean code patterns |
| `security-fundamentals.mdc` | Zero trust, input validation, secrets |
| `git-workflow.mdc` | Commits, branches, PRs, safety |
| `communication.mdc` | Direct, objective, professional |

#### Javascript-expert Rules

| Rule | Purpose |
|------|---------|
| `javascript-expert-language-deep-dive.mdc` | language deep dive guidelines |
| `javascript-expert-node-patterns.mdc` | node patterns guidelines |
| `javascript-expert-overview.mdc` | overview guidelines |
| `javascript-expert-performance.mdc` | performance guidelines |
| `javascript-expert-react-patterns.mdc` | react patterns guidelines |
| `javascript-expert-testing.mdc` | testing guidelines |
| `javascript-expert-tooling.mdc` | tooling guidelines |
| `javascript-expert-typescript-deep-dive.mdc` | typescript deep dive guidelines |

#### Web-backend Rules

| Rule | Purpose |
|------|---------|
| `web-backend-api-design.mdc` | api design guidelines |
| `web-backend-authentication.mdc` | authentication guidelines |
| `web-backend-database-patterns.mdc` | database patterns guidelines |
| `web-backend-error-handling.mdc` | error handling guidelines |
| `web-backend-overview.mdc` | overview guidelines |
| `web-backend-security.mdc` | security guidelines |
| `web-backend-testing.mdc` | testing guidelines |

#### Qa-engineering Rules

| Rule | Purpose |
|------|---------|
| `qa-engineering-automation.mdc` | automation guidelines |
| `qa-engineering-metrics.mdc` | metrics guidelines |
| `qa-engineering-overview.mdc` | overview guidelines |
| `qa-engineering-quality-gates.mdc` | quality gates guidelines |
| `qa-engineering-test-design.mdc` | test design guidelines |
| `qa-engineering-test-strategy.mdc` | test strategy guidelines |

#### Testing Rules

| Rule | Purpose |
|------|---------|
| `testing-advanced-techniques.mdc` | advanced techniques guidelines |
| `testing-ci-cd-integration.mdc` | ci cd integration guidelines |
| `testing-overview.mdc` | overview guidelines |
| `testing-performance-testing.mdc` | performance testing guidelines |
| `testing-quality-metrics.mdc` | quality metrics guidelines |
| `testing-reliability.mdc` | reliability guidelines |
| `testing-tdd-methodology.mdc` | tdd methodology guidelines |
| `testing-test-data.mdc` | test data guidelines |
| `testing-test-design.mdc` | test design guidelines |
| `testing-test-types.mdc` | test types guidelines |

## Customization

- Create new `.mdc` files in `.cursor/rules/` for project-specific rules
- Edit existing files directly; changes take effect immediately
- Re-run to update: `npx @djm204/agent-skills javascript-expert web-backend qa-engineering testing`
