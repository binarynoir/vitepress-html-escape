import type { MarkdownIt, StateCore } from 'markdown-it';
import { escapeUnbalancedTags } from './escapeTags.js';
import { escapeInterpolation, escapeInterpolationInText } from './interpolation.js';
import { resolveSettings } from './settings.js';
import type { HtmlEscapeOptions } from './types.js';

/**
 * A markdown-it plugin that keeps stray angle brackets and `{{ }}` in prose
 * from breaking VitePress's Vue compile.
 *
 * ```ts
 * import MarkdownIt from 'markdown-it';
 * import { markdownHtmlEscape } from '@binarynoir/vitepress-html-escape';
 *
 * const md = new MarkdownIt({ html: true }).use(markdownHtmlEscape);
 * ```
 *
 * Tags are escaped after parsing, as a core rule at the end of the chain, so
 * code blocks, inline code and autolinks never reach it, and HTML emitted by
 * plugins that run earlier (such as `vitepress-markdown-tags`) is checked like
 * any other. `{` is escaped as text, inline code and indented code blocks
 * render. VitePress protects fenced code itself, with `v-pre`, but leaves
 * the other two for Vue to interpolate.
 *
 * A page can turn either part off with `htmlEscape` in its frontmatter (see
 * the README). That needs VitePress's `env.frontmatter`, so under plain
 * markdown-it only the options apply.
 */
export function markdownHtmlEscape(md: MarkdownIt, options: HtmlEscapeOptions = {}): void {
  md.core.ruler.push('html_escape', (state: StateCore) => {
    if (resolveSettings(state.env?.frontmatter, options).tags) escapeUnbalancedTags(state);
  });

  // markdown-it's default renderer defines all three rules wrapped below.
  const wrap = (name: 'text' | 'code_inline' | 'code_block', escape: (html: string) => string) => {
    const render = md.renderer.rules[name]!;
    md.renderer.rules[name] = (tokens, index, renderOptions, env, renderer) => {
      const html = render(tokens, index, renderOptions, env, renderer);
      return resolveSettings(env?.frontmatter, options).interpolation ? escape(html) : html;
    };
  };
  wrap('text', escapeInterpolation);
  wrap('code_inline', escapeInterpolationInText);
  wrap('code_block', escapeInterpolationInText);
}
