# vitepress-html-escape

[![npm version](https://img.shields.io/npm/v/@binarynoir/vitepress-html-escape.svg)](https://www.npmjs.com/package/@binarynoir/vitepress-html-escape)
[![CI](https://github.com/binarynoir/vitepress-html-escape/actions/workflows/ci.yml/badge.svg)](https://github.com/binarynoir/vitepress-html-escape/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@binarynoir/vitepress-html-escape.svg)](LICENSE)

A [VitePress 2](https://vitepress.dev) plugin that keeps stray angle brackets and
`{{ }}` in Markdown from breaking your build. Write `Array<string>` or
`<your-name>` in a sentence and it shows up as text instead of failing the Vue
compile. Real HTML and Vue components work exactly as before.

It's built for docs sites with many contributors, where you can't count on
everyone to remember the backticks.

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-Buy%20Me%20a%20Coffee-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/binarynoir)
[![Support me on Ko-fi](https://img.shields.io/badge/Support%20me-Ko--fi-blue?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/binarynoir)
[![Visit my website](https://img.shields.io/badge/Website-binarynoir.tech-8c8c8c?style=for-the-badge)](https://binarynoir.tech)

## The problem

VitePress compiles every Markdown page as a Vue template. Anything in your prose
that looks like an HTML tag is passed to Vue as one, so this sentence:

```md
The function returns Array<string>.
```

stops the whole build:

```txt
[plugin vite:vue] docs/api.md: Element is missing end tag.
```

The same happens with placeholders like `<your-name>`, a stray `</div>`, or
`Array<object>`. And `{{ value }}` doesn't fail, but Vue evaluates it, so the
reader sees the result instead of the text you wrote.

## What this does

```md
Returns Array<string> or Promise<T>. Replace <your-name> with yours.

Press <kbd>Ctrl</kbd><br>, see <Badge text="beta" /> and {{ value }}.
```

renders as:

> Returns Array&lt;string&gt; or Promise&lt;T&gt;. Replace &lt;your-name&gt; with yours.
>
> Press <kbd>Ctrl</kbd>, see the Badge component and &#123;&#123; value }}.

The rule is the one Vue itself applies: **a tag must have a matching end tag**.
Any start tag that's never closed, and any end tag with nothing to close, is
escaped. That catches generics and placeholders, including ones that happen to
share a name with a real element (`Array<object>`), while leaving alone:

- balanced HTML: `<kbd>Ctrl</kbd>`, `<details>…</details>`
- void elements: `<br>`, `<img src="...">`, `<hr>`
- self-closing tags: `<Badge text="beta" />`
- paired components, including ones wrapped around Markdown across blocks
- HTML emitted by other plugins, such as
  [`vitepress-markdown-tags`](https://github.com/binarynoir/vitepress-markdown-tags)
- `<script setup>`, `<style>`, comments, code blocks, inline code and autolinks

There's no list of components to keep up to date.

A few other things Vue rejects are escaped the same way, because contributors
write them by accident too:

- processing instructions (`<?php echo 1 ?>`) and CDATA sections, unless they
  sit inside `<svg>` or `<math>`, where Vue allows them
- a `<!--` that's never closed, which would otherwise hide the rest of the page

## Install

```sh
npm install @binarynoir/vitepress-html-escape
```

## Usage

Register the plugin in VitePress's own `markdown.config` hook, the same place
you'd add any other markdown-it plugin:

```ts
// .vitepress/config.mts
import { defineConfig } from 'vitepress';
import { markdownHtmlEscape } from '@binarynoir/vitepress-html-escape';

export default defineConfig({
  markdown: {
    config(md) {
      md.use(markdownHtmlEscape);
    },
  },
});
```

It runs after every other markdown-it rule, so it doesn't matter where it sits
among your other `md.use()` calls.

Prefer wrapping your config? `withHtmlEscape` does the same in one call, the
same way `withMermaid` or `withMarkdownTags` do:

```ts
import { withHtmlEscape } from '@binarynoir/vitepress-html-escape/vitepress';

export default withHtmlEscape(
  defineConfig({
    // ...your normal config
  }),
);
```

`withHtmlEscape` will not clobber a `markdown.config` you already have,
including one set by another `withX()` wrapper. It installs its own first, then
calls yours with the same arguments.

### Plain markdown-it

```ts
import MarkdownIt from 'markdown-it';
import { markdownHtmlEscape } from '@binarynoir/vitepress-html-escape';

const md = new MarkdownIt({ html: true }).use(markdownHtmlEscape);
```

With `html: false`, markdown-it already escapes every tag, so the plugin only
affects `{{ }}`.

## How tags are matched

Tags pair up only where they'd nest in the rendered page:

- Inside a paragraph, heading or table cell, tags pair with each other. A
  `<T>` in one table cell and a `</T>` in the next are both escaped.
- HTML blocks pair with each other inside the same container: the page itself,
  one list item, one blockquote or one `:::` container. That's what lets a
  component wrap Markdown:

  ```md
  <Tabs>

  Some **Markdown** inside.

  </Tabs>
  ```

- Names match case-insensitively, as in Vue (`<CodePen></codepen>` is a pair).
- Void end tags such as `</br>` are left alone; Vue reads `</br>` as `<br>`.
- A start tag left open inside a pair is escaped: in `<b><T></b>`, only `<T>`.
- Inside an HTML block, only the unbalanced tags are escaped; the rest of the
  block is left as written.

A line holding nothing but a placeholder (`<your-name>`) normally starts an HTML
block in CommonMark, which swallows the following lines as raw HTML, and an
unclosed `<!--` swallows the rest of the page. When the construct that started
the block is escaped, the block is parsed again as Markdown, so headings, lists
and emphasis after it still render. In a tight list the result stays tight.

## Interpolation

`{` in Markdown text is written as `&#123;`, which looks the same on the page
but stops Vue from reading `{{ }}` as an expression. VitePress already does this
inside code blocks; this extends it to prose.

Braces inside raw HTML blocks are left alone, so `<div>{{ value }}</div>` still
interpolates. VitePress's `{#custom-id}` heading anchors and `{.class}`
attributes are handled before rendering and keep working.

If a page uses interpolation on purpose (`{{ $frontmatter.title }}`, or
`{{ $params.name }}` in dynamic routes), turn it off for that page:

```md
---
htmlEscape:
  interpolation: false
---
```

## Turning it off for a page

The `htmlEscape` frontmatter key overrides the plugin options for one page:

```md
---
htmlEscape: false # turn everything off
---
```

```md
---
htmlEscape:
  tags: false # keep {{ }} escaping, leave tags as written
---
```

## Options

`markdownHtmlEscape(md, options)` and `withHtmlEscape(config, options)` take:

| Option          | Default | Description                                                              |
| --------------- | ------- | ------------------------------------------------------------------------ |
| `tags`          | `true`  | Escape unbalanced tags, unclosed comments, and stray `<?…?>` and CDATA.  |
| `interpolation` | `true`  | Escape `{` in Markdown text so Vue doesn't evaluate `{{ }}` expressions. |

The same keys work under `htmlEscape` in a page's frontmatter, where they win
over the options. Values that aren't `true` or `false` are ignored.

## Limits

- **Malformed HTML is escaped, not fixed.** If a contributor opens a `<div>` and
  forgets to close it, the `<div>` shows up as text instead of failing the
  build. That makes the mistake visible on the page; review will catch it.
- **Attribute names markdown-it doesn't accept** (`<Foo @click="go">` written
  inline in a paragraph) are already escaped by markdown-it before this plugin
  runs. Put such components on their own lines as an HTML block, or use
  `v-on:click`.
- **Mistakes inside real HTML tags still fail the build.** A duplicate
  attribute (`<div class="a" class="b">`) or a directive with no value
  (`<div v-if>`) is a Vue error in markup someone wrote on purpose, so it's
  left for the build to report.
- Interpolation escaping applies to Markdown text only, not to raw HTML or to
  attributes.

## API

```ts
import {
  markdownHtmlEscape,
  escapeInterpolation,
  VOID_TAGS,
  RAW_TEXT_TAGS,
  XML_CONTEXT_TAGS,
} from '@binarynoir/vitepress-html-escape';

escapeInterpolation(html: string): string
```

`escapeInterpolation` is the function applied to rendered text. `VOID_TAGS`
lists the elements that never need an end tag, `RAW_TEXT_TAGS` the elements
whose contents are never scanned, and `XML_CONTEXT_TAGS` the elements inside
which processing instructions and CDATA are kept.

## Related projects

| Project                                                                          | What it does                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| [vitepress-markdown-tags](https://github.com/binarynoir/vitepress-markdown-tags) | Inline status tags like `((tag\|Done\|green))` |
| [vitepress-auto-sidebar](https://github.com/binarynoir/vitepress-auto-sidebar)   | Sidebar generated from your docs folder        |
| [markdown-it-glossary](https://github.com/binarynoir/markdown-it-glossary)       | Hover definitions for glossary terms           |

## Releasing

Releases are tag-triggered. From a clean `main` that's in sync with
`origin/main`:

```sh
npm run release:patch   # or release:minor / release:major
```

This runs typecheck/lint/test/build locally, then `npm version <bump>` and
`git push --follow-tags`. Pushing the tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which re-runs
the checks, publishes to npm, and creates a GitHub release.

## License

MIT

---

## Support

If you encounter any issues or have questions, please open an issue on [GitHub](https://github.com/binarynoir/vitepress-html-escape/issues).

## Author

John Smith III

## Acknowledgments

Thanks to all contributors and users for their support and feedback.
