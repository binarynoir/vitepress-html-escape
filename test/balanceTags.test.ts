import { describe, expect, it } from 'vitest';
import { applyEdits, markUnbalanced, parseTag, scanTags, voidEndTagReplacement } from '../src/balanceTags.js';

const escapedNames = (html: string) => {
  const tags = scanTags(html);
  markUnbalanced(tags);
  return tags
    .filter((tag) => tag.isEscaped)
    .map((tag) => (tag.kind === 'tag' ? `${tag.isClosing ? '/' : ''}${tag.name}` : tag.kind));
};

/** Milliseconds `run` takes. */
const timeMs = (run: () => unknown) => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

describe('parseTag', () => {
  it('reads start, end and self-closing tags', () => {
    expect(parseTag('<div class="a">')).toMatchObject({ name: 'div', isClosing: false, isSelfClosing: false });
    expect(parseTag('</div>')).toMatchObject({ name: 'div', isClosing: true, isSelfClosing: false });
    expect(parseTag('<Badge text="x" />')).toMatchObject({ name: 'badge', isSelfClosing: true });
  });

  it('accepts Vue binding attributes', () => {
    expect(parseTag('<Foo :value="a > b" @click="go" #slot v-if="ok">')).toMatchObject({ name: 'foo' });
  });

  it('returns null for comments and declarations', () => {
    expect(parseTag('<!-- note -->')).toBeNull();
    expect(parseTag('<!DOCTYPE html>')).toBeNull();
  });

  it('reads processing instructions and CDATA as XML-only', () => {
    expect(parseTag('<?php echo 1 ?>')).toMatchObject({ kind: 'xmlOnly' });
    expect(parseTag('<![CDATA[ x ]]>')).toMatchObject({ kind: 'xmlOnly' });
  });
});

describe('scanTags', () => {
  it('does not backtrack badly on long unterminated tags', () => {
    for (const html of ['<a' + ' b=c'.repeat(20_000), '<a' + ' b = '.repeat(20_000), '<a' + ' '.repeat(20_000) + 'b']) {
      expect(timeMs(() => scanTags(html))).toBeLessThan(500);
    }
  });

  it('finds tags in order with their offsets', () => {
    expect(scanTags('<a>x</a>').map(({ name, offset, isClosing }) => [name, offset, isClosing])).toEqual([
      ['a', 0, false],
      ['a', 4, true],
    ]);
  });

  it('skips closed comments and their contents', () => {
    expect(scanTags('<!-- <T> --><b></b>').map((tag) => tag.name)).toEqual(['b', 'b']);
  });

  it('reports an unclosed comment and keeps scanning after it', () => {
    expect(scanTags('<b></b><!-- <T>').map((tag) => tag.kind)).toEqual(['tag', 'tag', 'unclosedComment', 'tag']);
  });

  it('reports processing instructions and CDATA without scanning inside them', () => {
    expect(scanTags('<?php $a = "<T>"; ?><![CDATA[ <U> ]]>').map((tag) => tag.kind)).toEqual(['xmlOnly', 'xmlOnly']);
  });

  it('skips raw-text elements and their contents', () => {
    expect(scanTags('<script setup lang="ts">\nconst a = ref<string>()\n</script>')).toEqual([]);
    expect(scanTags('<style>a > b {}</style><i></i>').map((tag) => tag.name)).toEqual(['i', 'i']);
  });

  it('only ends a raw-text element at its own end tag', () => {
    expect(scanTags('<title>a</script></title>')).toEqual([]);
  });

  it('treats an unclosed raw-text tag like any other tag', () => {
    expect(scanTags('Array<title>').map((tag) => tag.name)).toEqual(['title']);
  });
});

describe('markUnbalanced', () => {
  it('leaves balanced, void and self-closing tags alone', () => {
    expect(escapedNames('<div><span>x</span><br><img src="a.png"><Badge /></div>')).toEqual([]);
  });

  it('escapes start tags that are never closed', () => {
    expect(escapedNames('Array<string>')).toEqual(['string']);
    expect(escapedNames('Array<object>')).toEqual(['object']);
  });

  it('escapes end tags with nothing to close', () => {
    expect(escapedNames('x</T>')).toEqual(['/t']);
  });

  it('escapes tags left open inside a pair', () => {
    expect(escapedNames('<b><T></b>')).toEqual(['t']);
  });

  it('matches names case-insensitively', () => {
    expect(escapedNames('<CodePen></codepen>')).toEqual([]);
  });

  it('pairs a closing tag with the nearest open tag of the same name', () => {
    expect(escapedNames('<div><div></div>')).toEqual(['div']);
  });

  it('never escapes void end tags', () => {
    expect(escapedNames('a</br>b</img></BR>')).toEqual([]);
  });

  it('always escapes unclosed comments', () => {
    expect(escapedNames('<div></div><!-- forgot')).toEqual(['unclosedComment']);
  });

  it('escapes processing instructions and CDATA outside svg and math', () => {
    expect(escapedNames('<?php echo 1 ?><div><![CDATA[ x ]]></div>')).toEqual(['xmlOnly', 'xmlOnly']);
  });

  it('keeps processing instructions and CDATA inside svg or math', () => {
    expect(escapedNames('<svg><![CDATA[ x ]]><g><?xml-stylesheet x?></g></svg><math><![CDATA[ y ]]></math>')).toEqual(
      [],
    );
    expect(escapedNames('<svg></svg><![CDATA[ x ]]>')).toEqual(['xmlOnly']);
  });

  it('runs in linear time on pathological input', () => {
    const tags = scanTags('<T>'.repeat(50_000) + '</x>'.repeat(50_000));
    expect(timeMs(() => markUnbalanced(tags))).toBeLessThan(500);
    expect(tags.every((tag) => tag.isEscaped)).toBe(true);
  });
});

describe('voidEndTagReplacement', () => {
  const replacements = (html: string) => scanTags(html).map(voidEndTagReplacement);

  it('writes </br> as <br>, in any case', () => {
    expect(replacements('</br></BR></Br >')).toEqual(['<br>', '<br>', '<br>']);
  });

  it('drops other void end tags, as browsers ignore them', () => {
    expect(replacements('</img></HR>')).toEqual(['', '']);
  });

  it('leaves every other construct alone', () => {
    expect(replacements('<br></div><div><?x ?>')).toEqual([null, null, null, null]);
  });
});

describe('applyEdits', () => {
  const escape = (offset: number) => ({ offset, length: 1, text: '&lt;' });

  it('replaces only the given ranges', () => {
    expect(applyEdits('<a><T></a>', [escape(3)])).toBe('<a>&lt;T></a>');
    expect(applyEdits('a</br>b', [{ offset: 1, length: 5, text: '<br>' }])).toBe('a<br>b');
  });

  it('handles edits in any order', () => {
    expect(applyEdits('<x><y>', [escape(3), escape(0)])).toBe('&lt;x>&lt;y>');
  });

  it('runs in linear time with many edits', () => {
    const html = '<T>'.repeat(50_000);
    const edits = Array.from({ length: 50_000 }, (_, index) => escape(index * 3));
    let result = '';
    expect(timeMs(() => (result = applyEdits(html, edits)))).toBeLessThan(500);
    expect(result).toBe('&lt;T>'.repeat(50_000));
  });
});
