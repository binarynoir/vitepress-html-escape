# Contributing

## Setup

```sh
npm install
```

## Workflow

```sh
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run format:check  # prettier --check .
npm test              # vitest run
npm run build          # tsup -> dist/
```

Run all five (or `npm run test:watch` / `npm run format` while iterating)
before opening a PR — CI runs the same checks against Node 22, 24, and 26,
and `main` is protected: changes only land through a PR with CI passing.

## Guidelines

- Add or update tests in `test/` for any behavior change.
- Anything a contributor might write that breaks the Vue compile belongs in
  `BREAKING_CASES` in `test/vueCompile.test.ts`; valid HTML the plugin must
  leave alone belongs in `UNCHANGED_CASES`. `test/vitepress-build.test.ts`
  builds the site in `test/fixtures/site` with the real `vitepress build`.
- Keep the README's Options table and "How tags are matched" section in
  sync with any option or matching change.
- Follow the existing naming conventions (see `src/` — full descriptive
  identifiers, `is`/`to`/`get`-prefixed helpers) rather than introducing new
  patterns.
- Add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for any
  user-facing change.

## Releasing

See the [Releasing](README.md#releasing) section of the README — maintainers
only.
