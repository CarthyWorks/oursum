# Contributing to Oursum

Thanks for contributing to Oursum.

## Before You Start

- Read the README for project setup and development commands.
- Read the Code of Conduct before participating in issues, discussions, or pull
  requests.
- Prefer focused changes over broad refactors unrelated to the issue you are
  solving.

## Development Setup

```bash
bun install
bun run dev
```

Useful commands:

```bash
bun run lint
bun run lint:types
bun test src/core/
bun run test:e2e
```

## Contribution Guidelines

- Open an issue before starting large changes, new features, or architectural
  work.
- Keep pull requests small enough to review effectively.
- Add or update tests when behavior changes.
- Keep documentation in sync when commands, workflows, or user-facing behavior
  change.
- Follow the existing code style and project structure.

## Pull Request Checklist

Before opening a pull request, make sure you have:

- Run linting and relevant tests locally.
- Verified the app still builds and runs for the area you changed.
- Updated related documentation when needed.
- Included a clear summary of what changed and why.

## Reporting Issues

When reporting a bug, include:

- The expected behavior
- The actual behavior
- Steps to reproduce
- Relevant logs, screenshots, or sample input files when available
- Your environment details, such as macOS version and app version

## Communication

For conduct-related concerns or contributor communication, contact
oursum@proton.me.

By contributing to this project, you agree to follow the Code of Conduct in
CODE_OF_CONDUCT.md.