import type { StateCore, Token } from 'markdown-it';
import {
  applyEdits,
  escapeEdit,
  markUnbalanced,
  parseTag,
  scanTags,
  voidEndTagReplacement,
  type Edit,
  type TagOccurrence,
} from './balanceTags.js';
import { blockRunEdits, wrapInlineRuns, type BlockCodeTag, type CodeConstruct } from './codeRuns.js';
import { escapeHtml, escapeMessage, hintMarkup, lineAt, voidEndTagMessage } from './hints.js';
import { escapeInterpolation } from './interpolation.js';
import { lineOffset, setNestedLineOffset } from './source.js';
import type { TagRules } from './types.js';

interface TokenTag extends TagOccurrence {
  token: Token;
}

/**
 * Escapes unbalanced tags across a parsed page, in place.
 *
 * Tags only pair up within the same container, because that is what the
 * rendered HTML nests: `html_block` tokens pair with each other inside one
 * list item, blockquote or the page itself, and `html_inline` tokens pair
 * inside one paragraph, heading or table cell.
 *
 * Processing instructions, CDATA sections and unclosed comments are escaped
 * the same way, since Vue rejects them too (see `markUnbalanced`). Void end
 * tags are rewritten the way browsers read them (see `voidEndTagReplacement`).
 *
 * Only constructs whose rule is on in `rules` are touched (see `ruleFor`).
 * With `hints`, each escaped or rewritten construct is also wrapped in a hint
 * span explaining what is wrong (see `hintMarkup`). With `asCode`, escaped
 * tags, `<?…?>` and CDATA are shown as inline code covering the whole word
 * they belong to (see `isShownAsCode`).
 */
export function escapeUnbalancedTags(state: StateCore, rules: Required<TagRules>, hints = false, asCode = false): void {
  const handles = (tag: TagOccurrence) => {
    const rule = ruleFor(tag);
    return rule !== null && rules[rule];
  };
  const display: Display = { hints, asCode };
  escapeBlockTags(state, handles, display);
  for (const token of state.tokens) {
    if (token.type === 'inline' && token.children) escapeInlineTags(state, token, handles, display);
  }
}

interface Display {
  hints: boolean;
  asCode: boolean;
}

/**
 * Whether `asCode` shows an escaped construct as code: unbalanced tags,
 * `<?…?>` and CDATA. An unclosed comment is prose that would have been
 * hidden, and a void end tag is rewritten, not escaped, so neither is.
 */
export const isShownAsCode = (tag: TagOccurrence): boolean =>
  tag.isEscaped && tag.kind !== 'unclosedComment' && voidEndTagReplacement(tag) === null;

/** A construct's markup inside a code span: escaped text, or a hint span showing it. */
function codeContent(source: string, tag: TagOccurrence, hints: boolean, file?: string, line?: number): string {
  if (!hints) return escapeInterpolation(escapeHtml(source));
  return hintMarkup(source, 'error', escapeMessage(tag, source, 'code'), { line, file });
}

/**
 * The rule that covers a construct, once `markUnbalanced` has run, or `null`
 * when there is nothing to do with it.
 */
export function ruleFor(tag: TagOccurrence): keyof TagRules | null {
  if (voidEndTagReplacement(tag) !== null) return 'voidEndTags';
  if (!tag.isEscaped) return null;
  if (tag.kind === 'unclosedComment') return 'unclosedComments';
  if (tag.kind === 'xmlOnly') return 'xmlSyntax';
  return tag.isClosing ? 'strayEndTags' : 'unclosedTags';
}

type Handles = (tag: TagOccurrence) => boolean;

/** The VitePress source file being rendered, for hint locations. */
export const sourceFile = (state: StateCore): string | undefined =>
  typeof state.env?.relativePath === 'string' ? state.env.relativePath : undefined;

/**
 * The edit for a construct that must be escaped or rewritten. Without hints
 * an escape only touches the `<`; with hints the whole construct is replaced
 * by a hint span showing it as text.
 */
function editFor(
  tag: TagOccurrence,
  source: string,
  hints: boolean,
  file: string | undefined,
  line: number | undefined,
): Edit {
  const replacement = voidEndTagReplacement(tag);
  const whole = (text: string): Edit => ({ offset: tag.offset, length: tag.length, text });
  if (!hints) return replacement === null ? escapeEdit(tag) : whole(replacement);
  const text = source.slice(tag.offset, tag.offset + tag.length);
  if (replacement === null) return whole(hintMarkup(text, 'error', escapeMessage(tag, text), { line, file }));
  return whole(hintMarkup(text, 'warning', voidEndTagMessage(tag, text), { line, file }) + replacement);
}

const LIST_OPEN_TYPES = new Set(['bullet_list_open', 'ordered_list_open']);

function escapeBlockTags(state: StateCore, handles: Handles, { hints, asCode }: Display): void {
  const scopes: TokenTag[][] = [[]];
  const openScopes = [scopes[0]];
  const openContainers: Token[] = [];
  // For each html_block sitting directly in a list item, the list it belongs to.
  const listOfBlock = new Map<Token, Token>();
  // Lists with a visible paragraph: markdown-it hides paragraphs in tight lists.
  const looseLists = new Set<Token>();

  for (const token of state.tokens) {
    const list = getListOfItemContent(openContainers);
    if (token.nesting === 1) {
      if (token.type === 'paragraph_open' && !token.hidden && list) looseLists.add(list);
      const scope: TokenTag[] = [];
      scopes.push(scope);
      openScopes.push(scope);
      openContainers.push(token);
    } else if (token.nesting === -1) {
      if (openScopes.length > 1) openScopes.pop();
      openContainers.pop();
    } else if (token.type === 'html_block') {
      if (list) listOfBlock.set(token, list);
      openScopes.at(-1)!.push(...scanTags(token.content).map((tag) => ({ ...tag, token })));
    }
  }

  const file = sourceFile(state);
  const offset = lineOffset(state);
  const editsByToken = new Map<Token, Edit[]>();
  const escapedOffsets = new Map<Token, number[]>();
  const codeTagsByToken = new Map<Token, BlockCodeTag[]>();
  for (const scope of scopes) {
    markUnbalanced(scope);
    for (const tag of scope) {
      if (!handles(tag)) continue;
      const { content, map } = tag.token;
      const line = map ? lineAt(map[0] + offset, content, tag.offset) : undefined;
      if (asCode && isShownAsCode(tag)) {
        const text = content.slice(tag.offset, tag.offset + tag.length);
        const codeTags = codeTagsByToken.get(tag.token) ?? [];
        // Raw HTML around it is kept as written, so only `<` needs escaping without hints.
        const render = () => (hints ? codeContent(text, tag, hints, file, line) : `&lt;${text.slice(1)}`);
        codeTags.push({ offset: tag.offset, length: tag.length, render, isClosing: tag.isClosing });
        codeTagsByToken.set(tag.token, codeTags);
      } else {
        const edits = editsByToken.get(tag.token) ?? [];
        edits.push(editFor(tag, content, hints, file, line));
        editsByToken.set(tag.token, edits);
      }
      if (!tag.isEscaped) continue;
      const offsets = escapedOffsets.get(tag.token) ?? [];
      offsets.push(tag.offset);
      escapedOffsets.set(tag.token, offsets);
    }
  }
  for (const [token, codeTags] of codeTagsByToken) {
    editsByToken.set(token, [...(editsByToken.get(token) ?? []), ...blockRunEdits(token.content, codeTags)]);
  }
  if (editsByToken.size === 0) return;

  state.tokens = state.tokens.flatMap((token) => {
    const edits = editsByToken.get(token);
    if (!edits) return [token];
    const content = applyEdits(token.content, edits);
    if (!escapedOffsets.get(token)?.includes(token.content.search(/\S/))) {
      token.content = content;
      return [token];
    }
    const list = listOfBlock.get(token);
    return reparseAsMarkdown(state, token, content, list !== undefined && !looseLists.has(list));
  });
}

/** The list whose item is the innermost open container, if any. */
function getListOfItemContent(openContainers: readonly Token[]): Token | undefined {
  const [list, item] = openContainers.slice(-2);
  return item?.type === 'list_item_open' && LIST_OPEN_TYPES.has(list.type) ? list : undefined;
}

/**
 * When the construct that started an HTML block is escaped, the block was
 * never meant as HTML: a line holding only `<your-name>` swallows the lines
 * after it as raw HTML, and an unclosed `<!--` swallows the rest of the page.
 * The escaped content is parsed again as Markdown, with every core rule
 * (this one included) and at the block's own nesting level. In a tight list
 * its paragraphs stay hidden, as markdown-it's own would be.
 */
function reparseAsMarkdown(state: StateCore, block: Token, content: string, isInTightList: boolean): Token[] {
  const nested = new state.md.core.State(content, state.md, state.env);
  const blockLine = block.map?.[0] ?? 0;
  setNestedLineOffset(nested, lineOffset(state) + blockLine);
  state.md.core.process(nested);

  for (const token of nested.tokens) {
    if (isInTightList && token.level === 0 && token.type.startsWith('paragraph_')) token.hidden = true;
    token.level += block.level;
    if (token.map) token.map = [token.map[0] + blockLine, token.map[1] + blockLine];
  }
  return nested.tokens;
}

interface InlineTag extends TokenTag {
  line: number | undefined;
}

function escapeInlineTags(state: StateCore, inline: Token, handles: Handles, { hints, asCode }: Display): void {
  const file = sourceFile(state);
  const tags: InlineTag[] = [];
  for (const { token, line } of inlineLines(inline, lineOffset(state))) {
    if (token.type !== 'html_inline') continue;
    const tag = parseTag(token.content);
    if (tag) tags.push({ ...tag, token, line });
  }
  markUnbalanced(tags);
  const codeTokens = new Map<Token, CodeConstruct>();
  for (const tag of tags) {
    if (!handles(tag)) continue;
    if (asCode && isShownAsCode(tag)) {
      const text = tag.token.content;
      codeTokens.set(tag.token, {
        render: () => codeContent(text, tag, hints, file, tag.line),
        isClosing: tag.isClosing,
      });
      continue;
    }
    if (!hints && tag.isEscaped && voidEndTagReplacement(tag) === null) {
      // The text renderer escapes `<` and `>` itself.
      tag.token.type = 'text';
      continue;
    }
    tag.token.content = editFor(tag, tag.token.content, hints, file, tag.line).text;
  }
  if (codeTokens.size > 0) inline.children = wrapInlineRuns(state, inline.children!, codeTokens);
}

/**
 * Each child of an inline token with the 1-based source line it starts on,
 * when the inline token has a line map. `offset` is the state's `lineOffset`.
 */
export function inlineLines(inline: Token, offset: number): { token: Token; line: number | undefined }[] {
  let line = inline.map ? inline.map[0] + offset + 1 : undefined;
  return (inline.children ?? []).map((token) => {
    const start = line;
    if (line !== undefined) {
      if (token.type === 'softbreak' || token.type === 'hardbreak') line++;
      else line = lineAt(line - 1, token.content, token.content.length);
    }
    return { token, line: start };
  });
}
