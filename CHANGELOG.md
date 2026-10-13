# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-10-13

### Added

- `hints` option, and `htmlEscape: { hints: true }` per page, which marks everything the plugin escaped or corrected so authors can fix it: unbalanced tags, unclosed comments, stray `<?…?>` and CDATA (errors), and void end tags and `{{ }}` in prose (warnings). Each hint carries a message saying what is wrong and how to fix it, with its source line and, under VitePress, its file
- rules for each kind of problem, all on by default: `tags` takes `unclosedTags`, `strayEndTags`, `unclosedComments`, `xmlSyntax` and `voidEndTags`, and `interpolation` takes `prose` and `code`. Turn single rules off in the options (`tags: { voidEndTags: false }`) or per page in `htmlEscape` frontmatter, where an object changes only the rules it names. `true` and `false` still switch a whole group
- `enableHtmlEscapeHints()` from `@binarynoir/vitepress-html-escape/client`, which underlines hints with a wavy line, gives them a `not-allowed` cursor, and shows the message in a popover on hover, click or tap

## [0.2.0] - 2026-10-13

### Fixed

- `{{ }}` in inline code and indented code blocks is escaped too. VitePress protects only fenced code, so Vue evaluated these, and `` `{{ value }}` `` rendered as empty code
- end tags for void elements are written the way browsers read them: `</br>` becomes `<br>` instead of being dropped by Vue, other void end tags (`</img>`) are removed, and upper-case ones such as `</BR>` no longer fail the build with `Invalid end tag`

## [0.1.0] - 2026-10-13

### Added

- initial release: `markdownHtmlEscape` markdown-it plugin, which escapes unbalanced tags (`Array<string>`, `<your-name>`, stray end tags) and `{{ }}` interpolation in Markdown text, and the `withHtmlEscape` VitePress wrapper
- `htmlEscape` frontmatter key to turn escaping off, or tune it, for a single page
- unclosed `<!--` comments, and processing instructions (`<?php ?>`) and CDATA outside `<svg>` and `<math>`, are escaped too, since Vue rejects them
