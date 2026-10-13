import type { UserConfig } from 'vitepress';
import type { MarkdownIt } from 'markdown-it';
import { markdownHtmlEscape } from './plugin.js';
import type { HtmlEscapeOptions } from './types.js';

/**
 * Wraps a VitePress config with HTML escaping, the same way `withMarkdownTags`
 * from `vitepress-markdown-tags` does for tags.
 *
 * ```ts
 * // .vitepress/config.mts
 * import { defineConfig } from 'vitepress';
 * import { withHtmlEscape } from '@binarynoir/vitepress-html-escape/vitepress';
 *
 * export default withHtmlEscape(defineConfig({ /* ...your config... *\/ }));
 * ```
 *
 * An existing `markdown.config` is not replaced: this wrapper runs first, then
 * calls yours with the same arguments, so it composes with other `withX()`
 * wrappers in any order.
 */
export function withHtmlEscape(config: UserConfig, options: HtmlEscapeOptions = {}): UserConfig {
  config.markdown ??= {};
  const existingMarkdownConfig = config.markdown.config ?? (() => {});
  config.markdown.config = (md) => {
    // VitePress 2 types this callback against `markdown-it-async`'s MarkdownIt,
    // a structural superset of plain markdown-it's; the cast bridges the two.
    markdownHtmlEscape(md as unknown as MarkdownIt, options);
    existingMarkdownConfig(md);
  };
  return config;
}
