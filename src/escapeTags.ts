import type { StateCore, Token } from 'markdown-it';
import { escapeAtOffsets, markUnbalanced, parseTag, scanTags, type TagOccurrence } from './balanceTags.js';

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
 * the same way, since Vue rejects them too (see `markUnbalanced`).
 */
export function escapeUnbalancedTags(state: StateCore): void {
  escapeBlockTags(state);
  for (const token of state.tokens) {
    if (token.type === 'inline' && token.children) escapeInlineTags(token.children);
  }
}

const LIST_OPEN_TYPES = new Set(['bullet_list_open', 'ordered_list_open']);

function escapeBlockTags(state: StateCore): void {
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

  const escapedOffsets = new Map<Token, number[]>();
  for (const scope of scopes) {
    markUnbalanced(scope);
    for (const tag of scope.filter((scopeTag) => scopeTag.isEscaped)) {
      const offsets = escapedOffsets.get(tag.token) ?? [];
      offsets.push(tag.offset);
      escapedOffsets.set(tag.token, offsets);
    }
  }
  if (escapedOffsets.size === 0) return;

  state.tokens = state.tokens.flatMap((token) => {
    const offsets = escapedOffsets.get(token);
    if (!offsets) return [token];
    const content = escapeAtOffsets(token.content, offsets);
    if (!offsets.includes(token.content.search(/\S/))) {
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
  state.md.core.process(nested);

  const lineOffset = block.map?.[0] ?? 0;
  for (const token of nested.tokens) {
    if (isInTightList && token.level === 0 && token.type.startsWith('paragraph_')) token.hidden = true;
    token.level += block.level;
    if (token.map) token.map = [token.map[0] + lineOffset, token.map[1] + lineOffset];
  }
  return nested.tokens;
}

function escapeInlineTags(children: Token[]): void {
  const tags: TokenTag[] = [];
  for (const token of children) {
    if (token.type !== 'html_inline') continue;
    const tag = parseTag(token.content);
    if (tag) tags.push({ ...tag, token });
  }
  markUnbalanced(tags);
  // The text renderer escapes `<` and `>` itself.
  for (const tag of tags.filter((inlineTag) => inlineTag.isEscaped)) tag.token.type = 'text';
}
