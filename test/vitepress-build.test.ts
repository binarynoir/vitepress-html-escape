import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vitepress';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Builds test/fixtures/site with the real `vitepress build`, alongside
// vitepress-markdown-tags and markdown-it-glossary. Every page in the fixture
// would fail the build, or render wrong, without this plugin.
const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/site');
const outDir = mkdtempSync(path.join(tmpdir(), 'vitepress-html-escape-'));

/** The rendered page body, between the h1 and the end of <main>. */
function readPage(page: string): string {
  const html = readFileSync(path.join(outDir, `${page}.html`), 'utf-8');
  return html.slice(html.indexOf('<h1'), html.indexOf('</main>'));
}

beforeAll(async () => {
  await build(siteRoot, { outDir });
}, 120_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
  rmSync(path.join(siteRoot, '.vitepress/cache'), { recursive: true, force: true });
});

describe('vitepress build', () => {
  describe('index page', () => {
    let page = '';
    beforeAll(() => {
      page = readPage('index');
    });

    it('escapes generics and placeholders in prose', () => {
      expect(page).toContain('Array&lt;string&gt;, Array&lt;object&gt;, Promise&lt;T&gt; and Record&lt;K, V&gt;');
      expect(page).toContain('replace &lt;your-name&gt;, then a stray &lt;/div&gt; by mistake');
    });

    it('re-parses a placeholder alone on its line as Markdown', () => {
      expect(page).toContain('<p>&lt;your-placeholder&gt; continues with <strong>bold</strong> text.</p>');
    });

    it('keeps a placeholder in a tight list item tight', () => {
      expect(page).toContain('<li>&lt;list-placeholder&gt;</li>');
    });

    it('shows {{ }} as written', () => {
      expect(page).toContain('Interpolation {{ 1 + 1 }} and an object {a: 1}.');
      expect(page).toContain('Items: {{ items.length }}');
    });

    it('escapes processing instructions and CDATA in prose', () => {
      expect(page).toContain('PHP inline: &lt;?php echo 1 ?&gt; and CDATA: &lt;![CDATA[ x ]]&gt;.');
    });

    it('works with vitepress-markdown-tags, VitePress components and plain HTML', () => {
      expect(page).toContain('<span class="md-tag md-tag--green">Done</span>');
      expect(page).toContain('<span class="VPBadge tip">');
      expect(page).toContain('<kbd>Ctrl</kbd>+<kbd>C</kbd><br>');
    });

    it('works with markdown-it-glossary', () => {
      expect(page).toMatch(/Our <abbr[^>]*title="Static site generator\."[^>]*>SSG<\/abbr> builds this page\./);
    });

    it('keeps VitePress heading anchors, containers, blockquotes and tables working', () => {
      expect(page).toContain('<h1 id="prose"');
      expect(page).toContain('Inside a container: Map&lt;K, V&gt; and Set&lt;T&gt;.');
      expect(page).toContain('Quoted Promise&lt;Result&gt;.');
      expect(page).toContain('<td>List&lt;T&gt;</td>');
    });

    it('keeps a details block wrapped around Markdown', () => {
      expect(page).toMatch(/<details><summary>More<\/summary><p>Body with Iterable&lt;T&gt;\.<\/p><\/details>/);
    });

    it('leaves code blocks alone', () => {
      expect(page).toContain('Array');
      expect(page).not.toContain('&amp;lt;');
    });
  });

  it('honors htmlEscape.interpolation: false in frontmatter', () => {
    const page = readPage('guide/interpolation');
    expect(page).toContain('Sum: 2.');
    expect(page).toContain('Array&lt;T&gt;');
  });

  it('honors htmlEscape: false in frontmatter', () => {
    expect(readPage('guide/disabled')).toContain('Sum: 4.');
  });

  it('escapes an unclosed comment and renders the rest of the page as Markdown', () => {
    const page = readPage('guide/unclosed-comment');
    expect(page).toContain('&lt;!-- a contributor forgot to close this');
    expect(page).toMatch(/<h2 id="heading-after-it"/);
    expect(page).toContain('Still <strong>Markdown</strong> with Array&lt;T&gt;.');
  });
});
