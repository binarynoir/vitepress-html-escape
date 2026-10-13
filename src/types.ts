/**
 * Which kinds of tag problems the plugin handles. Every rule is on unless
 * set to `false`. A rule that is off leaves its construct as written, so Vue
 * sees it, and may fail the build on it.
 */
export interface TagRules {
  /** Start tags that are never closed, shown as text: `Array<string>`, `<your-name>`. */
  unclosedTags?: boolean;
  /** End tags with nothing to close, shown as text: a stray `</div>`. */
  strayEndTags?: boolean;
  /** A `<!--` with no `-->`, shown as text instead of hiding the rest of the page. */
  unclosedComments?: boolean;
  /** Processing instructions (`<?php ?>`) and CDATA outside `<svg>` and `<math>`, shown as text. */
  xmlSyntax?: boolean;
  /** Void end tags written the way browsers read them: `</br>` becomes `<br>`, `</img>` is removed. */
  voidEndTags?: boolean;
}

/**
 * Where the plugin stops Vue from evaluating `{{ }}`. Every rule is on unless
 * set to `false`. Fenced code blocks are always protected by VitePress itself.
 */
export interface InterpolationRules {
  /** `{{ }}` in Markdown text: paragraphs, headings, lists, tables, link text. */
  prose?: boolean;
  /** `{{ }}` in inline code and indented code blocks. */
  code?: boolean;
}

export interface HtmlEscapeOptions {
  /**
   * Handle tags Vue would reject: unbalanced tags, unclosed comments, stray
   * `<?…?>` and CDATA, and void end tags. `true` or `false` sets every rule;
   * an object sets rules one by one, leaving the rest on. Default: `true`.
   */
  tags?: boolean | TagRules;
  /**
   * Escape `{` so `{{ value }}` is shown as written instead of being
   * evaluated by Vue. `true` or `false` sets both rules; an object sets them
   * one by one, leaving the other on. Default: `true`.
   */
  interpolation?: boolean | InterpolationRules;
  /**
   * Mark everything the plugin escaped or corrected with a hint, so authors
   * can see what to fix: unbalanced tags, unclosed comments, stray `<?…?>`
   * and CDATA, void end tags such as `</br>`, and `{{ }}` in prose. Each one
   * is wrapped in a `<span class="html-escape-hint">` that explains what is
   * wrong. Call `enableHtmlEscapeHints()` from
   * `@binarynoir/vitepress-html-escape/client` in the browser to underline
   * them and show the explanation on hover, click or tap. Default: `false`.
   */
  hints?: boolean;
}

/**
 * What a page can put under `htmlEscape` in its frontmatter: `false` turns
 * the plugin off for that page, an object overrides individual options. A
 * `tags` or `interpolation` object overrides only the rules it sets, on top
 * of the plugin options.
 */
export type HtmlEscapeFrontmatter = false | HtmlEscapeOptions;
