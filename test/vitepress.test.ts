import MarkdownIt from 'markdown-it';
import { describe, expect, it, vi } from 'vitest';
import { withHtmlEscape } from '../src/vitepress.js';
import type { UserConfig } from 'vitepress';

// VitePress 2 types `markdown.config` against `markdown-it-async`'s MarkdownIt,
// a structural superset of plain markdown-it's. A real `markdown-it` instance
// is fine at runtime, so this helper just bridges the two types.
type Md = InstanceType<typeof MarkdownIt>;

function runMarkdownConfig(config: UserConfig, md: Md): void {
  (config.markdown!.config as unknown as (md: Md) => void)(md);
}

describe('withHtmlEscape', () => {
  it('adds a markdown.config when the input config has none', () => {
    const config = withHtmlEscape({} as UserConfig);
    const md = new MarkdownIt({ html: true });
    runMarkdownConfig(config, md);
    expect(md.render('Array<T>')).toContain('Array&lt;T&gt;');
  });

  it('does not replace an existing markdown.config: it still runs, with the same md', () => {
    const userConfig = vi.fn();
    const config = withHtmlEscape({ markdown: { config: userConfig } } as unknown as UserConfig);
    const md = new MarkdownIt({ html: true });
    runMarkdownConfig(config, md);

    expect(userConfig).toHaveBeenCalledTimes(1);
    expect(userConfig).toHaveBeenCalledWith(md);
    expect(md.render('Array<T>')).toContain('Array&lt;T&gt;');
  });

  it('installs the plugin before the existing config runs', () => {
    let renderedInsideUserConfig = '';
    const config = withHtmlEscape({
      markdown: {
        config: (instance: Md) => {
          renderedInsideUserConfig = instance.render('Array<T>');
        },
      },
    } as unknown as UserConfig);
    runMarkdownConfig(config, new MarkdownIt({ html: true }));
    expect(renderedInsideUserConfig).toContain('Array&lt;T&gt;');
  });

  it('passes options through to the plugin', () => {
    const config = withHtmlEscape({} as UserConfig, { interpolation: false });
    const md = new MarkdownIt({ html: true });
    runMarkdownConfig(config, md);
    expect(md.render('{{ x }}')).toBe('<p>{{ x }}</p>\n');
  });

  it('preserves other markdown options', () => {
    const config = withHtmlEscape({ markdown: { lineNumbers: true } } as UserConfig);
    expect(config.markdown?.lineNumbers).toBe(true);
  });

  it('returns the same config object', () => {
    const input = {} as UserConfig;
    expect(withHtmlEscape(input)).toBe(input);
  });
});
