import { compile } from '@vue/compiler-dom';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { markdownHtmlEscape } from '../src/plugin.js';

const md = (options = {}) => new MarkdownIt({ html: true }).use(markdownHtmlEscape, { hints: true, ...options });
const render = (source: string, env: Record<string, unknown> = {}) => md().render(source, env);

interface Hint {
  level: string;
  text: string;
  message: string;
  line?: string;
  file?: string;
}

/** Every hint span in rendered HTML, with its attributes decoded. */
function hints(html: string): Hint[] {
  const decode = (value: string) =>
    value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#123;/g, '{')
      .replace(/&amp;/g, '&');
  return [...html.matchAll(/<span class="html-escape-hint html-escape-hint--(\w+)"([^>]*)>([^<]*)<\/span>/g)].map(
    ([, level, attributes, text]) => {
      const attribute = (name: string) => {
        const value = new RegExp(`${name}="([^"]*)"`).exec(attributes)?.[1];
        return value === undefined ? undefined : decode(value);
      };
      return {
        level,
        text: decode(text),
        message: attribute('data-html-escape-hint')!,
        line: attribute('data-html-escape-hint-line'),
        file: attribute('data-html-escape-hint-file'),
      };
    },
  );
}

function vueErrors(html: string): string[] {
  const errors: string[] = [];
  compile(`<div>${html}</div>`, { onError: (error) => errors.push(error.message) });
  return errors;
}

describe('hints', () => {
  it('are off by default', () => {
    expect(new MarkdownIt({ html: true }).use(markdownHtmlEscape).render('Array<T> {{ x }}')).not.toContain(
      'html-escape-hint',
    );
  });

  it('mark an unclosed tag as an error, with its line and file', () => {
    const [hint] = hints(render('Intro\n\nReturns Array<string>.', { relativePath: 'guide/api.md' }));
    expect(hint).toMatchObject({ level: 'error', text: '<string>', line: '3', file: 'guide/api.md' });
    expect(hint.message).toContain('`<string>` is never closed');
  });

  it('count lines inside a paragraph', () => {
    expect(hints(render('one\ntwo\nthree </div>'))[0]).toMatchObject({ text: '</div>', line: '3' });
  });

  it('leave out the file under plain markdown-it', () => {
    expect(hints(render('<T>'))[0].file).toBeUndefined();
  });

  it('explain stray end tags, unclosed comments, and processing instructions', () => {
    const [stray, pi] = hints(render('Oops </div> and <?php echo 1 ?>.'));
    expect(stray.message).toContain('`</div>` has no matching `<div>`');
    expect(pi.message).toContain('processing instructions');
    const [comment] = hints(render('Text.\n\n<!-- forgot\n\nMore.'));
    expect(comment).toMatchObject({ level: 'error', text: '<!--', line: '3' });
    expect(comment.message).toContain('never closed with `-->`');
  });

  it('sit inside the code span with asCode, around the construct only', () => {
    const html = md({ asCode: true }).render('Returns Array<string> and {{ x }}.');
    expect(html).toContain('<code>Array<span class="html-escape-hint html-escape-hint--error"');
    const [tag, braces] = hints(html);
    expect(tag).toMatchObject({ level: 'error', text: '<string>' });
    expect(tag.message).toContain('shown as code');
    expect(braces).toMatchObject({ level: 'warning', text: '{{ x }}' });
    expect(braces.message).toContain('shown as code');
  });

  it('mark escaped tags inside HTML blocks and re-parsed blocks', () => {
    expect(hints(render('<div>\nArray<T>\n</div>'))[0]).toMatchObject({ text: '<T>', line: '2' });
    const html = render('<your-name>\nis **you**.');
    expect(hints(html)[0]).toMatchObject({ text: '<your-name>', line: '1' });
    expect(html).toContain('<strong>you</strong>');
  });

  it('count lines from the file, not the block, in re-parsed blocks', () => {
    const found = hints(render('Intro\n\n<your-name>\nis {{ x }} and Array<T>.'));
    expect(found.map(({ text, line }) => [text, line])).toEqual([
      ['<your-name>', '3'],
      ['{{ x }}', '4'],
      ['<T>', '4'],
    ]);
  });

  it('mark void end tags as warnings, keeping the line break', () => {
    const html = render('a</br>b</IMG>c');
    expect(html).toContain('</span><br>b');
    const [br, img] = hints(html);
    expect(br).toMatchObject({ level: 'warning', text: '</br>' });
    expect(br.message).toContain('Write `<br>` instead');
    expect(img).toMatchObject({ level: 'warning', text: '</IMG>' });
    expect(img.message).toContain('`<IMG>` never takes an end tag');
  });

  it('mark {{ }} in prose as a warning, and leave code alone', () => {
    const html = render('Value {{ 1 + 1 }} and `{{ code }}`.');
    expect(hints(html)).toEqual([expect.objectContaining({ level: 'warning', text: '{{ 1 + 1 }}', line: '1' })]);
    expect(html).toContain('<code>&#123;&#123; code }}</code>');
  });

  it('do not mark {{ }} when interpolation escaping is off', () => {
    expect(md({ interpolation: false }).render('{{ x }}')).toBe('<p>{{ x }}</p>\n');
  });

  it('can be turned on or off per page', () => {
    const plain = new MarkdownIt({ html: true }).use(markdownHtmlEscape);
    expect(plain.render('<T>', { frontmatter: { htmlEscape: { hints: true } } })).toContain('html-escape-hint');
    expect(render('<T>', { frontmatter: { htmlEscape: { hints: false } } })).toBe('<p>&lt;T&gt;</p>\n');
  });

  it('escape quotes and braces in what they show', () => {
    const html = render('A <Foo title="{{ x }}"> here.');
    expect(html).toContain('&lt;Foo title=&quot;&#123;&#123; x }}&quot;&gt;</span>');
  });

  it('produce HTML that Vue compiles without errors', () => {
    const source = [
      'Array<T> and </div> and <?php ?> and <![CDATA[ x ]]>',
      '<your-name>\nwith **bold** {{ x }}',
      '- one\n- <your-fork>',
      '<div>\nList<T> {{ y }}\n</div>',
      'a</br>b</BR>c</img>',
      '| <T> | </T> |\n| - | - |\n| {{ a }} | b |',
      'Text.\n\n<!-- forgot\n\nAfter {{ z }}',
    ].join('\n\n');
    expect(vueErrors(render(source, { relativePath: 'a"b.md' }))).toEqual([]);
  });
});
