import type { StateCore, Token } from 'markdown-it';
import { inlineLines, sourceFile } from './escapeTags.js';
import { HINT_CLASS, INTERPOLATION_MESSAGE, hintMarkup, lineAt } from './hints.js';
import { lineOffset } from './source.js';

const INTERPOLATION = /\{\{[\s\S]*?\}\}/g;
const HINT_OPEN = `<span class="${HINT_CLASS}`;

/**
 * Wraps each `{{ … }}` in Markdown text in a hint span, so readers of a page
 * with hints on can see what Vue would have evaluated. Code is left alone:
 * braces there are always meant as written.
 */
export function markInterpolation(state: StateCore): void {
  const file = sourceFile(state);
  const offset = lineOffset(state);
  for (const inline of state.tokens) {
    if (inline.type !== 'inline' || !inline.children) continue;
    const children: Token[] = [];
    // Inside a hint span that a re-parsed block split into separate tokens.
    let inHint = false;
    for (const { token, line } of inlineLines(inline, offset)) {
      if (token.type === 'html_inline') {
        if (token.content.startsWith(HINT_OPEN) && !token.content.endsWith('</span>')) inHint = true;
        else if (inHint && token.content === '</span>') inHint = false;
      }
      if (token.type !== 'text' || inHint || !token.content.includes('{{')) {
        children.push(token);
        continue;
      }
      children.push(...splitInterpolation(state, token, line, file));
    }
    inline.children = children;
  }
}

function splitInterpolation(
  state: StateCore,
  token: Token,
  line: number | undefined,
  file: string | undefined,
): Token[] {
  const tokens: Token[] = [];
  const pushText = (content: string) => {
    if (!content) return;
    const text = new state.Token('text', '', 0);
    text.content = content;
    tokens.push(text);
  };
  let start = 0;
  for (const match of token.content.matchAll(INTERPOLATION)) {
    pushText(token.content.slice(start, match.index));
    const hint = new state.Token('html_inline', '', 0);
    const location = { line: lineAt(line === undefined ? undefined : line - 1, token.content, match.index), file };
    hint.content = hintMarkup(match[0], 'warning', INTERPOLATION_MESSAGE, location);
    tokens.push(hint);
    start = match.index + match[0].length;
  }
  if (start === 0) return [token];
  pushText(token.content.slice(start));
  return tokens;
}
