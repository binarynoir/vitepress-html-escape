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

[Documentation and live demo](https://binarynoir.tech/plugins/html-escape/)

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-Buy%20Me%20a%20Coffee-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/binarynoir)
[![Support me on Ko-fi](https://img.shields.io/badge/Support%20me-Ko--fi-blue?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/binarynoir)
[![More tools](https://img.shields.io/badge/Website-binarynoir.tech-8c8c8c?style=for-the-badge)](https://binarynoir.tech)

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

End tags for void elements are written the way browsers read them: `</br>`
becomes `<br>`, and the rest (`</img>`, `</hr>`) are dropped, as browsers
ignore them. Left to Vue, `</br>` silently loses its line break and `</BR>`
fails the build.

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
- Void end tags never pair with anything: `</br>` becomes `<br>` and the
  others are dropped (see above).
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
but stops Vue from reading `{{ }}` as an expression. That covers prose, inline
code (`` `{{ value }}` ``) and indented code blocks, which VitePress otherwise
leaves for Vue to evaluate. Fenced code blocks are already protected by
VitePress and are left as they are.

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

## Showing escapes as code

By default an escaped tag shows up as plain text. Most of the time it was
meant as code, and the author just forgot the backticks. Turn on `asCode` and
the plugin adds them for you: everything it escapes is shown as inline code,
exactly as if it had been written in backticks.

```ts
md.use(markdownHtmlEscape, { asCode: true });
```

| You write                        | Shown as                           |
| -------------------------------- | ---------------------------------- |
| `Returns Array<string>.`         | Returns `Array<string>`.           |
| `Run it against <host>:<port>.`  | Run it against `<host>:<port>`.    |
| `Use (Promise<T>) or fn(Set<T>)` | Use (`Promise<T>`) or `fn(Set<T>)` |
| `Paste <?php echo $v; ?> here.`  | Paste `<?php echo $v; ?>` here.    |
| `Template: {{ user.name }}`      | Template: `{{ user.name }}`        |
| `a template</div> by mistake`    | a template`</div>` by mistake      |

The code span covers the whole word, not just the brackets, so `Array<string>`
stays in one piece:

- The text attached to a construct joins it (`Array` in `Array<string>`, `[]`
  in `Array<string>[]`), and constructs written without a space between them
  become one span (`<host>:<port>`).
- Sentence punctuation, quotes, and brackets that wrap the word stay outside:
  `(Array<T>).` shows `Array<T>` as code. Brackets that are part of the code,
  as in `fn(Array<T>)`, stay inside.
- The word before a stray end tag stays outside, since it is the content the
  tag was meant to close.

It applies to unbalanced tags, stray `<?…?>` and CDATA, and `{{ }}` in prose
when interpolation escaping is on. Unclosed comments are shown as text (they
are prose that would have been hidden), void end tags are still rewritten,
and real HTML and components are left alone. With hints on as well, the wavy
underline marks just the construct inside the code span.

Turn it on or off for one page in its frontmatter:

```md
---
htmlEscape:
  asCode: true
---
```

Generics that markdown-it never reads as a tag, such as `Map<string, number>`
(a comma can't follow a tag name), are already plain text that Vue accepts.
The plugin doesn't touch them, so they aren't shown as code.

## Hints: showing authors what to fix

Escaping keeps the build green, but the mistake is still on the page. Turn on
`hints` and every spot the plugin escaped or corrected gets a wavy underline
and a `not-allowed` cursor. Hover it (or click or tap it) and a popover says
what is wrong, how to fix it, and where it is in the source:

> guide/api.md, line 12
>
> `<T>` is never closed, so it is shown as text. If it is code or a
> placeholder, put it in backticks so it shows as code. If it is an element,
> add `</T>`.

Two levels are marked:

- **Errors** (red): unbalanced tags, unclosed comments, and stray `<?…?>` and
  CDATA. Each would have failed the build or hidden part of the page.
- **Warnings** (amber): void end tags the plugin rewrote (`</br>`) or removed
  (`</img>`), and `{{ }}` in prose. The page renders, but the source may
  still need a look. Braces in code are never marked.

Hints have two halves. The `hints` option marks the spots up while the page
renders:

```ts
md.use(markdownHtmlEscape, { hints: true });
// or
withHtmlEscape(defineConfig({ ... }), { hints: true });
```

and `enableHtmlEscapeHints()` adds the underline and popovers in the browser.
In VitePress, call it from your theme:

```ts
// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enableHtmlEscapeHints } from '@binarynoir/vitepress-html-escape/client';

export default {
  extends: DefaultTheme,
  enhanceApp() {
    enableHtmlEscapeHints();
  },
};
```

To show hints only while you write, turn them on outside production builds:

```ts
withHtmlEscape(config, { hints: process.env.NODE_ENV !== 'production' });
```

or turn them on for a single page with `htmlEscape: { hints: true }` in its
frontmatter.

| `enableHtmlEscapeHints` option | Default | Description                                                                  |
| ------------------------------ | ------- | ---------------------------------------------------------------------------- |
| `hover`                        | `true`  | Show the popover on mouse hover. `false` for click and tap only.             |
| `hoverDelay`                   | `300`   | Milliseconds the mouse rests on a hint before the popover shows.             |
| `injectStyles`                 | `true`  | Inject the default styles. `false` lets you style `.html-escape-hint` yours. |

The default look follows VitePress theme colors. Override it with the
`--html-escape-hint-error`, `--html-escape-hint-warning`,
`--html-escape-hint-popover-bg`, `--html-escape-hint-popover-fg` and
`--html-escape-hint-popover-border` CSS variables. Each hint is a
`<span class="html-escape-hint html-escape-hint--error">` (or `--warning`)
whose `data-html-escape-hint` attribute holds the message, with
`data-html-escape-hint-line` and, under VitePress, `data-html-escape-hint-file`
for its location. `enableHtmlEscapeHints()` returns a function that removes
its listeners.

## Choosing what it handles

Every kind of problem has its own rule, and every rule is on by default. Turn
off the ones you don't want, for the whole site in the options or for one page
in its frontmatter. A rule that is off leaves its construct exactly as written,
so Vue sees it and may fail the build on it, as it would without the plugin.

| Group           | Rule               | What it handles                                                           |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| `tags`          | `unclosedTags`     | Start tags never closed, shown as text: `Array<string>`, `<your-name>`.   |
| `tags`          | `strayEndTags`     | End tags with nothing to close, shown as text: a stray `</div>`.          |
| `tags`          | `unclosedComments` | A `<!--` with no `-->`, shown as text instead of hiding the page.         |
| `tags`          | `xmlSyntax`        | `<?…?>` and CDATA outside `<svg>` and `<math>`, shown as text.            |
| `tags`          | `voidEndTags`      | `</br>` written as `<br>`, and other void end tags (`</img>`) removed.    |
| `interpolation` | `prose`            | `{{ }}` in Markdown text: paragraphs, headings, lists, tables, link text. |
| `interpolation` | `code`             | `{{ }}` in inline code and indented code blocks.                          |

Set a group to `true` or `false` to switch all of its rules at once, or to an
object to switch rules one by one. Rules an object doesn't name keep their
current value:

```ts
md.use(markdownHtmlEscape, {
  tags: { voidEndTags: false }, // every other tag rule stays on
  interpolation: { code: false },
});
```

Rules are opt-out rather than opt-in on purpose: each one prevents a broken
build or a page that renders wrong, so new rules in later versions are on
for you too.

### Per page

The `htmlEscape` frontmatter key overrides the options for one page. An object
there changes only the rules it names, on top of the site-wide options, so a
page can turn one rule back on without repeating the rest:

```md
---
htmlEscape:
  tags:
    voidEndTags: true # back on for this page; other rules as configured
  interpolation:
    prose: false # this page uses {{ $frontmatter.title }} on purpose
---
```

A boolean replaces the whole group, and `false` for the key itself turns the
plugin off for the page:

```md
---
htmlEscape:
  tags: false # leave every tag as written, keep {{ }} escaping
---
```

```md
---
htmlEscape: false # turn everything off
---
```

## Options

`markdownHtmlEscape(md, options)` and `withHtmlEscape(config, options)` take:

| Option          | Default | Description                                                                                                                 |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tags`          | `true`  | `true`, `false`, or an object of tag rules (see [Choosing what it handles](#choosing-what-it-handles)).                     |
| `interpolation` | `true`  | `true`, `false`, or an object of interpolation rules (see above).                                                           |
| `hints`         | `false` | Mark what was escaped or corrected, for authors (see [Hints](#hints-showing-authors-what-to-fix)).                          |
| `asCode`        | `false` | Show what was escaped as inline code, as if written in backticks (see [Showing escapes as code](#showing-escapes-as-code)). |

The same keys work under `htmlEscape` in a page's frontmatter, where they win
over the options. Values that aren't `true` or `false`, and rule names the
plugin doesn't know, are ignored.

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
- Interpolation escaping applies to Markdown text and code only, not to raw
  HTML or to attributes.

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

## Feedback and support

Bug reports, feature requests and questions are all welcome. Please open them on this project's [GitHub issue tracker](https://github.com/binarynoir/vitepress-html-escape/issues):

- **Found a bug?** [Report it](https://github.com/binarynoir/vitepress-html-escape/issues/new?labels=bug&title=Bug%3A%20). Include your version and the steps to reproduce it.
- **Have an idea?** [Request a feature](https://github.com/binarynoir/vitepress-html-escape/issues/new?labels=enhancement&title=Feature%20request%3A%20). Tell us what you are trying to do.
- **Something else?** [Browse open issues](https://github.com/binarynoir/vitepress-html-escape/issues) to see if it has already been raised.

Pull requests are welcome too.

<!-- binarynoir:more:start (generated from binarynoir.github.io/products.json) -->

## More from BinaryNoir

<p align="center">
  <a href="https://binarynoir.tech">
    <img alt="BinaryNoir" src="https://binarynoir.tech/logo-horizontal.png" width="320">
  </a>
</p>

HTML Escape is one of a family of open-source tools from BinaryNoir.

**Pairs well with HTML Escape**

- [Broken Links](https://binarynoir.tech/plugins/broken-links): dead links shown as text, not build errors
- [Image Fallback](https://binarynoir.tech/plugins/image-fallback): a placeholder instead of a failed build
- [README Index](https://binarynoir.tech/plugins/readme-index/): `README.md` index pages for VuePress migrations

**New:** [Blog](https://binarynoir.tech/plugins/blog/): posts anywhere, a main blog and section blogs, with RSS feeds

**See them all:** VitePress plugins, Vite plugins, editor extensions and command-line tools, with documentation and live demos, at **[binarynoir.tech](https://binarynoir.tech)**.

<!-- binarynoir:more:end -->

## Author

John Smith III, [BinaryNoir](https://binarynoir.tech). Thanks to all contributors and users for their support and feedback.
