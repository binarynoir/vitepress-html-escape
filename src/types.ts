export interface HtmlEscapeOptions {
  /**
   * Escape tags that have no matching end tag (or an end tag with nothing to
   * close), so `Array<string>` renders as text instead of failing the Vue
   * compile. Unclosed comments, and processing instructions and CDATA outside
   * `<svg>` and `<math>`, are escaped too. Default: `true`.
   */
  tags?: boolean;
  /**
   * Escape `{` in Markdown text, so `{{ value }}` is shown as written instead
   * of being evaluated by Vue. Default: `true`.
   */
  interpolation?: boolean;
}

/**
 * What a page can put under `htmlEscape` in its frontmatter: `false` turns
 * the plugin off for that page, an object overrides individual options.
 */
export type HtmlEscapeFrontmatter = false | HtmlEscapeOptions;
