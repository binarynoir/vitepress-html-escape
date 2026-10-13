# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `{{ }}` in inline code and indented code blocks is escaped too. VitePress protects only fenced code, so Vue evaluated these, and `` `{{ value }}` `` rendered as empty code
- end tags for void elements are written the way browsers read them: `</br>` becomes `<br>` instead of being dropped by Vue, other void end tags (`</img>`) are removed, and upper-case ones such as `</BR>` no longer fail the build with `Invalid end tag`

## [0.1.0] - 2026-10-13

### Added

- initial release: `markdownHtmlEscape` markdown-it plugin, which escapes unbalanced tags (`Array<string>`, `<your-name>`, stray end tags) and `{{ }}` interpolation in Markdown text, and the `withHtmlEscape` VitePress wrapper
- `htmlEscape` frontmatter key to turn escaping off, or tune it, for a single page
- unclosed `<!--` comments, and processing instructions (`<?php ?>`) and CDATA outside `<svg>` and `<math>`, are escaped too, since Vue rejects them
