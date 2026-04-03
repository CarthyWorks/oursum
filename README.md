# Oursum

**Oursum** is a personal expense tracker desktop application built with [Electrobun](https://electrobun.dev/), React, and SQLite. It runs natively on macOS and is designed to be fast, private, and offline-first.

Contribute to Oursum by opening issues and submitting pull requests, or support
development with a tip on [Ko-fi](https://ko-fi.com/oursum).

---

## Features

- Import expenses from CSV and Excel files
- Automatic deduplication of transactions
- Flexible rule-based categorisation
- Split transaction support
- Localised date/currency parsing (multi-language)
- Persistent storage via SQLite (no cloud required)
- Keyboard-driven UI with command palette

## Requirements

- macOS (arm64 or x64)
- [Bun](https://bun.sh) ≥ 1.x

## Getting Started

```bash
# Install dependencies
bun install

# Start in development mode (with hot-reload)
bun run dev

# Start with Vite HMR
bun run dev:hmr

# Build a production bundle
bun run build

# Build a distributable DMG
bun run dmg
```

## Project Structure

```
src/
  core/       # Business logic: parsers, importers, dedup, rules, split
  renderer/   # React UI: components, hooks, store, context
  main/       # Electrobun main process & IPC handlers
  shared/     # Shared types and utilities
  types/      # Global TypeScript type definitions
e2e/          # Playwright end-to-end tests
scripts/      # Build and utility scripts
data/         # Test fixture data
```

## Testing

```bash
# Unit tests
bun test src/core/

# End-to-end tests
bun run test:e2e
```

## Linting

```bash
bun run lint        # ESLint
bun run lint:types  # TypeScript type check
```

## Support

If Oursum is useful to you, you can support development with a tip on
[Ko-fi](https://ko-fi.com/oursum).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Oursum is licensed under the [GNU General Public License v3.0](LICENSE).
