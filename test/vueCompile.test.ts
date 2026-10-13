import { compile } from '@vue/compiler-dom';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { markdownHtmlEscape } from '../src/plugin.js';

/**
 * Compiles rendered HTML as a Vue template, the way VitePress does, and
 * returns the errors. VitePress lifts `<script>` and `<style>` blocks out of
 * the template before compiling, so the warning about them is ignored here.
 */
function vueErrors(html: string): string[] {
  const errors: string[] = [];
  compile(`<div>${html}</div>`, { onError: (error) => errors.push(error.message) });
  return errors.filter((message) => !message.startsWith('Tags with side effect'));
}

const renderPlain = (source: string) => new MarkdownIt({ html: true }).render(source);
const renderEscaped = (source: string) => new MarkdownIt({ html: true }).use(markdownHtmlEscape).render(source);

/**
 * Things contributors write that fail Vue's compile under plain markdown-it.
 * Each one must fail without the plugin (so the case is real) and compile
 * cleanly with it.
 */
const BREAKING_CASES: Record<string, string> = {
  'generic in prose': 'Returns Array<string>.',
  'generic named like an HTML element': 'Takes an Array<object>.',
  'generic in a heading': '## Map<K, V> and Set<T>',
  'generic in a list item': '- Promise<Result>\n- other',
  'generic in a table cell': '| Type |\n| ---- |\n| List<T> |',
  'generic in a blockquote': '> Yields Iterable<T>.',
  'generic in emphasis': 'Use **Partial<Options>** here.',
  'generic in link text': 'See [Array<T>](/api).',
  'nested generics': 'A Map<string, Array<number>> value.',
  'placeholder in prose': 'Replace <your-name> with yours.',
  'placeholder alone on a line': '<your-name>\nis you.',
  'placeholder alone in a tight list': '- one\n- <your-name>\n- three',
  'stray end tag': 'Oops </div> here.',
  'unclosed real element': 'Text <span>never closed.',
  'tags crossing table cells': '| a | b |\n| - | - |\n| <T> | </T> |',
  'tags crossing paragraphs': 'Start <Foo>\n\nEnd </Foo>',
  'tags crossing list items': '- <Foo>\n- </Foo>',
  'tag left open inside a pair': 'Text <b>bold <T> more</b>.',
  'unbalanced tag inside an HTML block': '<div>\nArray<T>\n</div>',
  'unclosed comment block': 'Before.\n\n<!-- forgot\n\n## After',
  'unclosed comment inside an HTML block': '<div>\n<!-- forgot\n</div>',
  'processing instruction inline': 'Start with <?php echo 1 ?> please.',
  'processing instruction block': '<?php\necho 1;\n?>',
  'CDATA inline': 'Use <![CDATA[ x ]]> here.',
  'CDATA block': '<![CDATA[\nx\n]]>',
  'unclosed raw-text element': '<script>\nconst a = 1',
  'void end tag in upper case': 'Line </BR> break.',
};

/** Valid input the plugin must leave exactly as plain markdown-it renders it. */
const UNCHANGED_CASES: Record<string, string> = {
  'balanced inline HTML': 'Press <kbd>Ctrl</kbd> and <em>go</em>.',
  'void elements': 'Line<br>break<br/>and <img src="a.png"> <hr/>',
  'self-closing component': 'Status <Badge text="beta" />.',
  'paired component': '<CodePen id="x"></CodePen>',
  'component wrapped around Markdown': '<Tabs>\n\nSome **bold** text.\n\n</Tabs>',
  'component in a nested list': '- a\n  - <Tabs>\n\n    text\n\n    </Tabs>',
  'details block': '<details>\n<summary>More</summary>\n\nBody\n\n</details>',
  'HTML block in a blockquote': '> <div>\n> inside\n> </div>',
  'uppercase element closed in lowercase': '<DIV>x</div>',
  'attribute containing >': '<Foo title="a > b">x</Foo>',
  'tag spanning lines': 'Text <span\n  class="a">x</span> end.',
  'script setup with generics': '<script setup lang="ts">\nconst a = ref<string>()\n</script>',
  'style block': '<style>\na > b { color: red }\n</style>',
  comments: '<!-- Array<T> -->\n\nText <!-- <T> --> here.',
  'CDATA inside svg': '<svg><![CDATA[ x ]]></svg>',
  doctype: '<!DOCTYPE html>',
  code: '`Array<T>`\n\n```ts\nconst a: Array<T> = [];\n```',
  'autolinks and comparisons': 'a < b, c > d, <https://example.com>, <me@example.com>',
  'already escaped text': 'Array&lt;T&gt;',
};

describe('Vue compile', () => {
  describe.each(Object.entries(BREAKING_CASES))('%s', (_name, source) => {
    it('fails without the plugin', () => {
      expect(vueErrors(renderPlain(source))).not.toEqual([]);
    });

    it('compiles with the plugin', () => {
      expect(vueErrors(renderEscaped(source))).toEqual([]);
    });
  });

  describe.each(Object.entries(UNCHANGED_CASES))('%s', (_name, source) => {
    it('compiles and renders exactly as without the plugin', () => {
      const html = renderEscaped(source);
      expect(vueErrors(html)).toEqual([]);
      expect(html).toBe(renderPlain(source));
    });
  });

  it('compiles every breaking case together on one page', () => {
    expect(vueErrors(renderEscaped(Object.values(BREAKING_CASES).join('\n\n')))).toEqual([]);
  });
});
