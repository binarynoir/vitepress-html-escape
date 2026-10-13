import { compile } from '@vue/compiler-dom';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { markdownHtmlEscape } from '../src/plugin.js';

const render = (
  source: string,
  options?: Parameters<typeof markdownHtmlEscape>[1],
  env: Record<string, unknown> = {},
) => new MarkdownIt({ html: true }).use(markdownHtmlEscape, options).render(source, env);

/** Compiles rendered HTML as a Vue template, the way VitePress does, and returns the errors. */
function vueErrors(html: string): string[] {
  const errors: string[] = [];
  compile(`<div>${html}</div>`, { onError: (error) => errors.push(error.message) });
  return errors;
}

describe('markdownHtmlEscape', () => {
  it('registers a core rule at the end of the chain', () => {
    const md = new MarkdownIt().use(markdownHtmlEscape);
    const rules = (md.core.ruler as unknown as { __rules__: { name: string }[] }).__rules__.map((rule) => rule.name);
    expect(rules.at(-1)).toBe('html_escape');
  });

  describe('unbalanced tags', () => {
    it('escapes generic types in prose', () => {
      expect(render('Returns Array<string> or Promise<T>.')).toBe(
        '<p>Returns Array&lt;string&gt; or Promise&lt;T&gt;.</p>\n',
      );
    });

    it('escapes generics whose name is a real HTML element', () => {
      expect(render('Pass an Array<object>.')).toBe('<p>Pass an Array&lt;object&gt;.</p>\n');
    });

    it('escapes placeholders', () => {
      expect(render('Replace <your-name> with yours.')).toBe('<p>Replace &lt;your-name&gt; with yours.</p>\n');
    });

    it('escapes stray end tags', () => {
      expect(render('Oops </div> here.')).toBe('<p>Oops &lt;/div&gt; here.</p>\n');
    });

    it('re-parses a placeholder alone on its line as a paragraph, Markdown included', () => {
      expect(render('<your-name>\nis **you**.\n')).toBe('<p>&lt;your-name&gt;\nis <strong>you</strong>.</p>\n');
    });

    it('escapes unbalanced tags in headings, lists and table cells', () => {
      const html = render('# Map<K>\n\n- Set<V>\n\n| a |\n| - |\n| List<T> |\n');
      expect(html).toContain('<h1>Map&lt;K&gt;</h1>');
      expect(html).toContain('<li>Set&lt;V&gt;</li>');
      expect(html).toContain('<td>List&lt;T&gt;</td>');
    });

    it('does not pair tags across table cells or list items', () => {
      expect(render('| a | b |\n| - | - |\n| <T> | </T> |\n')).toContain('<td>&lt;T&gt;</td>\n<td>&lt;/T&gt;</td>');
      expect(vueErrors(render('- <Foo>\n\n- </Foo>\n'))).toEqual([]);
    });
  });

  describe('real HTML and components', () => {
    it('keeps balanced inline HTML and void elements', () => {
      expect(render('A <kbd>Ctrl</kbd> key<br>and <img src="a.png">.')).toBe(
        '<p>A <kbd>Ctrl</kbd> key<br>and <img src="a.png">.</p>\n',
      );
    });

    it('keeps self-closing and paired components', () => {
      expect(render('Status <Badge text="beta" /> and <MarkdownTag label="Done"></MarkdownTag>')).toBe(
        '<p>Status <Badge text="beta" /> and <MarkdownTag label="Done"></MarkdownTag></p>\n',
      );
    });

    it('keeps a component wrapped around Markdown across blocks', () => {
      const html = render('<Tabs>\n\nSome **bold** text.\n\n</Tabs>\n');
      expect(html).toBe('<Tabs>\n<p>Some <strong>bold</strong> text.</p>\n</Tabs>\n');
    });

    it('keeps a details block whose summary sits on the opening lines', () => {
      const source = '<details>\n<summary>More</summary>\n\nBody\n\n</details>\n';
      expect(render(source)).toBe(new MarkdownIt({ html: true }).render(source));
    });

    it('escapes only the unbalanced tags inside an HTML block', () => {
      expect(render('<div>\nArray<T>\n</div>\n')).toBe('<div>\nArray&lt;T>\n</div>\n');
    });

    it('leaves <script setup> and <style> contents untouched', () => {
      const source =
        '<script setup lang="ts">\nconst items = ref<string[]>([])\n</script>\n\n<style>\na > b {}\n</style>\n';
      expect(render(source)).toBe(new MarkdownIt({ html: true }).render(source));
    });

    it('leaves comments untouched', () => {
      expect(render('<!-- Array<T> -->\n\nText <!-- <T> --> here.')).toBe(
        '<!-- Array<T> -->\n<p>Text <!-- <T> --> here.</p>\n',
      );
    });
  });

  describe('things markdown-it already handles', () => {
    it('leaves code blocks and inline code alone', () => {
      expect(render('Use `Array<T>`.\n\n```ts\nconst a: Array<T> = [];\n```\n')).toBe(
        new MarkdownIt({ html: true }).render('Use `Array<T>`.\n\n```ts\nconst a: Array<T> = [];\n```\n'),
      );
    });

    it('leaves autolinks, comparisons and blockquotes alone', () => {
      const source = '> Quote with a < b and c > d, <https://example.com> and <me@example.com>.\n';
      expect(render(source)).toBe(new MarkdownIt({ html: true }).render(source));
    });
  });

  describe('blocks re-parsed as Markdown', () => {
    it('keeps a placeholder in a tight list item tight', () => {
      expect(render('- one\n- <your-name>\n- three\n')).toBe(
        '<ul>\n<li>one</li>\n<li>&lt;your-name&gt;</li>\n<li>three</li>\n</ul>\n',
      );
    });

    it('keeps a placeholder in a loose list item loose', () => {
      expect(render('- one\n\n- <your-name>\n\n- three\n')).toContain('<li>\n<p>&lt;your-name&gt;</p>\n</li>');
    });

    it('escapes an unclosed comment and renders the rest of the page as Markdown', () => {
      expect(render('Before.\n\n<!-- forgot\n\n## After\n\nArray<T> **here**.\n')).toBe(
        '<p>Before.</p>\n<p>&lt;!-- forgot</p>\n<h2>After</h2>\n<p>Array&lt;T&gt; <strong>here</strong>.</p>\n',
      );
    });

    it('escapes an unclosed comment inside an HTML block in place', () => {
      expect(render('<div>\n<!-- forgot\n</div>\n')).toBe('<div>\n&lt;!-- forgot\n</div>\n');
    });

    it('keeps source line maps pointing at the original lines', () => {
      const tokens = new MarkdownIt({ html: true }).use(markdownHtmlEscape).parse('Intro.\n\n<!-- x\n\n## After\n', {});
      expect(tokens.find((token) => token.type === 'heading_open')?.map).toEqual([4, 5]);
    });

    it('keeps re-parsed blocks at their nesting level', () => {
      const tokens = new MarkdownIt({ html: true }).use(markdownHtmlEscape).parse('> <your-name>\n', {});
      expect(tokens.find((token) => token.type === 'paragraph_open')?.level).toBe(1);
    });
  });

  describe('XML-only syntax', () => {
    it('escapes processing instructions in prose and as blocks', () => {
      expect(render('Start with <?php echo 1 ?> please.')).toBe('<p>Start with &lt;?php echo 1 ?&gt; please.</p>\n');
      expect(render('<?php\necho 1;\n?>\n')).toBe('<p>&lt;?php\necho 1;\n?&gt;</p>\n');
    });

    it('escapes CDATA outside svg and keeps it inside', () => {
      expect(render('Use <![CDATA[ x ]]> here.')).toBe('<p>Use &lt;![CDATA[ x ]]&gt; here.</p>\n');
      expect(render('<svg><![CDATA[ x ]]></svg>')).toBe('<p><svg><![CDATA[ x ]]></svg></p>\n');
    });
  });

  describe('HTML edge cases', () => {
    it('keeps self-closed void elements', () => {
      expect(render('a<br/>b<hr/>')).toBe('<p>a<br/>b<hr/></p>\n');
    });

    it('writes </br> as <br>, in any case, as browsers read it', () => {
      expect(render('a</br>b</BR>c')).toBe('<p>a<br>b<br>c</p>\n');
      expect(render('<div>\na</br>b\n</div>')).toBe('<div>\na<br>b\n</div>');
    });

    it('drops other void end tags, as browsers ignore them', () => {
      expect(render('a</img>b</HR>c')).toBe('<p>abc</p>\n');
      expect(render('<div>\na</IMG>b\n</div>')).toBe('<div>\nab\n</div>');
    });

    it('leaves void end tags alone when tag escaping is off', () => {
      expect(render('a</br>b', { tags: false })).toBe('<p>a</br>b</p>\n');
    });

    it('keeps a tag that spans lines inside a paragraph', () => {
      expect(render('Text <span\n  class="a">x</span> end.')).toBe('<p>Text <span\n  class="a">x</span> end.</p>\n');
    });

    it('pairs tags inside a blockquote, but not across its edge', () => {
      expect(render('> <div>\n> inside\n> </div>\n')).toBe('<blockquote>\n<div>\ninside\n</div>\n</blockquote>\n');
      expect(render('> <Foo>\n\n</Foo>\n')).toBe(
        '<blockquote>\n<p>&lt;Foo&gt;</p>\n</blockquote>\n<p>&lt;/Foo&gt;</p>\n',
      );
    });

    it('leaves already escaped text alone', () => {
      expect(render('Array&lt;T&gt;')).toBe('<p>Array&lt;T&gt;</p>\n');
    });
  });

  it('renders a large page quickly', () => {
    const md = new MarkdownIt({ html: true }).use(markdownHtmlEscape);
    const source = 'Array<T>, <b>bold</b> and <your-name>\n\n<T>\n\n'.repeat(5_000);
    const start = performance.now();
    md.render(source);
    expect(performance.now() - start).toBeLessThan(2_000);
  });

  describe('interpolation', () => {
    it('escapes {{ }} in text', () => {
      expect(render('Value: {{ 1 + 1 }}')).toBe('<p>Value: &#123;&#123; 1 + 1 }}</p>\n');
    });

    it('can be turned off in the options', () => {
      expect(render('{{ x }}', { interpolation: false })).toBe('<p>{{ x }}</p>\n');
    });

    it('escapes {{ }} in headings, link text and emphasis', () => {
      expect(render('# Head {{ a }}\n\n[link {{ b }}](/x) **{{ c }}**')).toBe(
        '<h1>Head &#123;&#123; a }}</h1>\n<p><a href="/x">link &#123;&#123; b }}</a> <strong>&#123;&#123; c }}</strong></p>\n',
      );
    });

    it('leaves image alt text alone, since Vue never interpolates attributes', () => {
      expect(render('![alt {{ c }}](/i.png)')).toBe('<p><img src="/i.png" alt="alt {{ c }}"></p>\n');
    });

    it('escapes {{ }} in inline code and indented code blocks, which VitePress leaves to Vue', () => {
      expect(render('`{{ x }}`\n\n    {{ y }}\n')).toBe(
        '<p><code>&#123;&#123; x }}</code></p>\n<pre><code>&#123;&#123; y }}\n</code></pre>\n',
      );
    });

    it('leaves attributes on inline code alone', () => {
      const md = new MarkdownIt({ html: true }).use(markdownHtmlEscape);
      md.core.ruler.push('add_attribute', (state) => {
        state.tokens[1].children![0].attrSet('data-x', '{a}');
      });
      expect(md.render('`{b}`')).toBe('<p><code data-x="{a}">&#123;b}</code></p>\n');
    });

    it('leaves braces in fenced code and raw HTML alone', () => {
      expect(render('```\n{{ x }}\n```\n\n<div>{{ y }}</div>\n')).toBe(
        '<pre><code>{{ x }}\n</code></pre>\n<div>{{ y }}</div>\n',
      );
    });

    it('leaves code alone when interpolation escaping is off', () => {
      expect(render('`{{ x }}`', { interpolation: false })).toBe('<p><code>{{ x }}</code></p>\n');
    });
  });

  describe('frontmatter', () => {
    it('turns everything off with htmlEscape: false', () => {
      expect(render('Array<T> {{ x }}', {}, { frontmatter: { htmlEscape: false } })).toBe('<p>Array<T> {{ x }}</p>\n');
    });

    it('overrides individual options', () => {
      expect(render('Array<T> {{ x }}', {}, { frontmatter: { htmlEscape: { interpolation: false } } })).toBe(
        '<p>Array&lt;T&gt; {{ x }}</p>\n',
      );
    });
  });

  describe('rules', () => {
    const source = 'A Array<T>, a </div>, <?php x ?>, a</br>b, {{ p }} and `{{ c }}`.';

    it('handles every kind by default', () => {
      expect(render(source)).toBe(
        '<p>A Array&lt;T&gt;, a &lt;/div&gt;, &lt;?php x ?&gt;, a<br>b, &#123;&#123; p }} and <code>&#123;&#123; c }}</code>.</p>\n',
      );
    });

    it('leaves each kind as written when its rule is off', () => {
      expect(render(source, { tags: { unclosedTags: false } })).toContain('A Array<T>, a &lt;/div&gt;');
      expect(render(source, { tags: { strayEndTags: false } })).toContain('A Array&lt;T&gt;, a </div>,');
      expect(render(source, { tags: { xmlSyntax: false } })).toContain(', <?php x ?>,');
      expect(render(source, { tags: { voidEndTags: false } })).toContain(', a</br>b,');
      expect(render(source, { interpolation: { prose: false } })).toContain(
        '{{ p }} and <code>&#123;&#123; c }}</code>',
      );
      expect(render(source, { interpolation: { code: false } })).toContain(
        '&#123;&#123; p }} and <code>{{ c }}</code>',
      );
    });

    it('leaves an unclosed comment as written when its rule is off', () => {
      expect(render('Text.\n\n<!-- forgot', { tags: { unclosedComments: false } })).toBe('<p>Text.</p>\n<!-- forgot');
      expect(render('Text.\n\n<!-- forgot')).toBe('<p>Text.</p>\n<p>&lt;!-- forgot</p>\n');
    });

    it('applies rules to HTML blocks, and keeps a placeholder block raw when its rule is off', () => {
      expect(render('<div>\nArray<T> </span>\n</div>', { tags: { strayEndTags: false } })).toBe(
        '<div>\nArray&lt;T> </span>\n</div>',
      );
      expect(render('<your-name>\nis **you**.', { tags: { unclosedTags: false } })).toBe('<your-name>\nis **you**.');
    });

    it('lets a page turn a rule back on', () => {
      const env = { frontmatter: { htmlEscape: { tags: { voidEndTags: true } } } };
      expect(render('a</br>b', { tags: { voidEndTags: false } }, env)).toBe('<p>a<br>b</p>\n');
    });

    it('marks hints only for rules that are on', () => {
      const html = render(source, { hints: true, tags: { unclosedTags: false }, interpolation: { prose: false } });
      expect(html).not.toContain('>&lt;T&gt;</span>');
      expect(html).not.toContain('{{ p }}</span>');
      expect(html).toContain('>&lt;/div&gt;</span>');
    });
  });

  it('can turn tag escaping off in the options', () => {
    expect(render('Array<T>', { tags: false })).toBe('<p>Array<T></p>\n');
  });

  it('is harmless when raw HTML is disabled', () => {
    expect(new MarkdownIt({ html: false }).use(markdownHtmlEscape).render('Array<T> <b>x</b>')).toBe(
      '<p>Array&lt;T&gt; &lt;b&gt;x&lt;/b&gt;</p>\n',
    );
  });

  it('produces HTML that Vue compiles without errors', () => {
    const source = [
      '# Generics: Map<K, V> and Array<string>',
      '',
      'Replace <your-name>, pass Array<object>, close </div> by mistake.',
      '',
      '<your-placeholder>',
      'continues **here**.',
      '',
      '- Item with Promise<T>',
      '- Item with <kbd>Ctrl</kbd><br>',
      '',
      '<Tabs>',
      '',
      'Wrapped text {{ not.evaluated }}.',
      '',
      '</Tabs>',
      '',
      '| Type | Example |',
      '| ---- | ------- |',
      '| Record<K, V> | <Badge text="x" /> |',
      '',
      '<div>',
      'Inside a block: Set<T>',
      '</div>',
    ].join('\n');
    expect(vueErrors(new MarkdownIt({ html: true }).render(source)).length).toBeGreaterThan(0);
    expect(vueErrors(render(source))).toEqual([]);
  });

  it('leaves unrelated Markdown untouched', () => {
    const source = '# Hi\n\nPlain text with <em>HTML</em> and `code`.\n';
    expect(render(source)).toBe(new MarkdownIt({ html: true }).render(source));
  });
});
