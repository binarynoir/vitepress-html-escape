import type { StateCore, Token } from 'markdown-it';
import type { Edit } from './balanceTags.js';
import { escapeHtml } from './hints.js';
import { escapeInterpolation } from './interpolation.js';

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const TRAILING_PUNCTUATION = /[.,;:!?'"]/;
const QUOTES = /['"]/;

/**
 * How much punctuation to leave outside the code span at each end of `run`:
 * sentence punctuation and quotes after it, quotes before it, and brackets
 * that wrap it or have no partner inside it. `(Array<T>).` keeps `Array<T>`,
 * while `fn(Array<T>)` and `Array<T>[]` stay whole.
 *
 * Tags start with `<` and end with `>`, so trimming only ever removes text
 * attached to them, never the tags themselves.
 */
export function trimRun(run: string): { start: number; end: number } {
  let start = 0;
  let end = run.length;
  for (;;) {
    const [lastStart, lastEnd] = [start, end];
    while (end > start && TRAILING_PUNCTUATION.test(run[end - 1])) end--;
    while (start < end && QUOTES.test(run[start])) start++;

    const close = PAIRS[run[start]];
    if (close && run[end - 1] === close) {
      start++;
      end--;
    } else if (close && !run.slice(start + 1, end).includes(close)) {
      start++;
    }
    const open = CLOSERS[run[end - 1]];
    if (open && !run.slice(start, end - 1).includes(open)) end--;

    if (start === lastStart && end === lastEnd) return { start, end };
  }
}

/** Inline code markup around already-escaped content. */
const codeMarkup = (html: string): string => `<code>${html}</code>`;

/** Text shown inside a code span, safe from both HTML and Vue. */
const codeText = (text: string): string => escapeInterpolation(escapeHtml(text));

/** An escaped construct to show as code. */
export interface CodeConstruct {
  /** Markup for the construct inside the code span. */
  render: () => string;
  /**
   * An end tag such as `</div>`. The word before an end tag is the content it
   * was meant to close, not part of the construct, so it stays outside.
   */
  isClosing: boolean;
}

/**
 * Wraps each escaped `html_inline` child in an inline code span that covers
 * the whole word it belongs to: the text attached to it on either side, and
 * any escaped constructs it is joined to without a space (`<host>:<port>`).
 */
export function wrapInlineRuns(
  state: StateCore,
  children: readonly Token[],
  constructs: ReadonlyMap<Token, CodeConstruct>,
): Token[] {
  const out: Token[] = [];
  let index = 0;
  while (index < children.length) {
    const token = children[index];
    if (!constructs.has(token)) {
      out.push(token);
      index++;
      continue;
    }

    const previous = out.at(-1)?.type === 'text' ? out.at(-1) : undefined;
    const before = previous && !constructs.get(token)!.isClosing ? /\S*$/.exec(previous.content)![0] : '';
    const parts: (string | Token)[] = [before];
    let after = '';
    let next: Token | undefined;
    while (index < children.length) {
      const child = children[index];
      if (constructs.has(child)) {
        parts.push(child);
        index++;
        continue;
      }
      if (child.type !== 'text') break;
      const word = /^\S*/.exec(child.content)![0];
      if (word === child.content && constructs.has(children[index + 1])) {
        parts.push(word);
        index++;
        continue;
      }
      after = word;
      next = child;
      break;
    }
    parts.push(after);

    const run = parts.map((part) => (typeof part === 'string' ? part : part.content)).join('');
    const { start, end } = trimRun(run);
    const trimmedAfter = run.length - end;
    parts[0] = before.slice(start);
    parts[parts.length - 1] = after.slice(0, after.length - trimmedAfter);

    if (previous) previous.content = previous.content.slice(0, previous.content.length - before.length + start);
    if (next) next.content = next.content.slice(after.length - trimmedAfter);

    const code = new state.Token('html_inline', '', 0);
    code.content = codeMarkup(
      parts.map((part) => (typeof part === 'string' ? codeText(part) : constructs.get(part)!.render())).join(''),
    );
    out.push(code);
  }
  return out;
}

/** One construct in a raw HTML block to show as code. */
export interface BlockCodeTag extends CodeConstruct {
  offset: number;
  length: number;
}

/**
 * The edits that wrap escaped constructs in a raw HTML block in code spans,
 * each covering the whole word it belongs to, as `wrapInlineRuns` does for
 * inline HTML. The text around a construct is already HTML, so it is kept as
 * written. A word stops at whitespace and at the edges of other tags.
 */
export function blockRunEdits(content: string, tags: readonly BlockCodeTag[]): Edit[] {
  const sorted = [...tags].sort((a, b) => a.offset - b.offset);
  const edits: Edit[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const first = sorted[index];
    const before = first.isClosing ? '' : /[^\s>]*$/.exec(content.slice(0, first.offset))![0];
    const parts: (string | BlockCodeTag)[] = [before, first];
    let end = first.offset + first.length;
    let after: string;
    for (;;) {
      const word = /^[^\s<]*/.exec(content.slice(end))![0];
      const following = sorted[index + 1];
      if (following && following.offset === end + word.length) {
        parts.push(word, following);
        end = following.offset + following.length;
        index++;
        continue;
      }
      after = word;
      break;
    }
    parts.push(after);

    const runStart = first.offset - before.length;
    const run = content.slice(runStart, end + after.length);
    const { start, end: runEnd } = trimRun(run);
    parts[0] = before.slice(start);
    parts[parts.length - 1] = after.slice(0, after.length - (run.length - runEnd));
    edits.push({
      offset: runStart + start,
      length: runEnd - start,
      text: codeMarkup(parts.map((part) => (typeof part === 'string' ? part : part.render())).join('')),
    });
  }
  return edits;
}
