import { RAW_TEXT_TAGS, VOID_TAGS, XML_CONTEXT_TAGS } from './constants.js';

/**
 * What a scanned construct is:
 *
 * - `tag`: a start, end or self-closing tag, balanced by name.
 * - `xmlOnly`: a processing instruction (`<?php ?>`) or CDATA section, which
 *   Vue rejects outside `<svg>` and `<math>`.
 * - `unclosedComment`: a `<!--` with no `-->`, which Vue rejects anywhere.
 */
export type OccurrenceKind = 'tag' | 'xmlOnly' | 'unclosedComment';

/** One construct found in a piece of raw HTML. */
export interface TagOccurrence {
  kind: OccurrenceKind;
  /** Lowercased tag name; empty for anything but a `tag`. */
  name: string;
  /** Index of the construct's `<` in the scanned string. */
  offset: number;
  /** Length of the construct in the scanned string. */
  length: number;
  isClosing: boolean;
  isSelfClosing: boolean;
  /** Set by `markUnbalanced` when the construct must be escaped. */
  isEscaped: boolean;
}

const VOID_TAG_NAMES = new Set<string>(VOID_TAGS);

// Attribute names are looser than markdown-it's so Vue bindings like
// `:value` and `@click` don't end the tag early.
const ATTRIBUTE = String.raw`\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?`;
const TAG = String.raw`<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:${ATTRIBUTE})*\s*(\/?)>`;
// Unclosed, these match only their opening characters, so once that opener
// is escaped the text after it is scanned as ordinary content.
const COMMENT = String.raw`<!--(?:[\s\S]*?-->)?`;
const PROCESSING_INSTRUCTION = String.raw`<\?(?:[\s\S]*?\?>)?`;
const CDATA = String.raw`<!\[CDATA\[(?:[\s\S]*?\]\]>)?`;
// A raw-text element with its own end tag: skipped whole, contents included.
// Without an end tag it falls through to TAG and is balanced like any other.
const RAW_TEXT_ELEMENT = RAW_TEXT_TAGS.map(
  (name) => String.raw`<${name}\b(?:"[^"]*"|'[^']*'|[^>"'])*>[\s\S]*?<\/${name}\s*>`,
).join('|');

const SINGLE_TAG_PATTERN = new RegExp(`^${TAG}$`);
const SINGLE_XML_ONLY_PATTERN = new RegExp(`^(?:${PROCESSING_INSTRUCTION}|${CDATA})$`);

function toTagOccurrence(match: RegExpExecArray, offset: number): TagOccurrence {
  const [text, closingSlash, name, selfClosingSlash] = match;
  const isClosing = closingSlash === '/';
  return {
    kind: 'tag',
    name: name.toLowerCase(),
    offset,
    length: text.length,
    isClosing,
    isSelfClosing: !isClosing && selfClosingSlash === '/',
    isEscaped: false,
  };
}

function toOtherOccurrence(kind: OccurrenceKind, offset: number, length: number): TagOccurrence {
  return { kind, name: '', offset, length, isClosing: false, isSelfClosing: false, isEscaped: false };
}

/**
 * Reads one `html_inline` token's content. Returns `null` for comments and
 * declarations (`<!DOCTYPE>`), which never need escaping.
 */
export function parseTag(html: string): TagOccurrence | null {
  const match = SINGLE_TAG_PATTERN.exec(html);
  if (match) return toTagOccurrence(match, 0);
  return SINGLE_XML_ONLY_PATTERN.test(html) ? toOtherOccurrence('xmlOnly', 0, html.length) : null;
}

/**
 * Finds every tag, processing instruction, CDATA section and unclosed comment
 * in a block of raw HTML, in order. Closed comments and the contents of
 * raw-text elements (`<script>`, `<style>`, ...) are skipped, because Vue
 * doesn't parse tags inside them either.
 */
export function scanTags(html: string): TagOccurrence[] {
  const pattern = new RegExp(`${COMMENT}|${PROCESSING_INSTRUCTION}|${CDATA}|${RAW_TEXT_ELEMENT}|${TAG}`, 'gi');
  const tags: TagOccurrence[] = [];
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    const [text] = match;
    if (match[2] !== undefined) {
      tags.push(toTagOccurrence(match, match.index));
    } else if (text.startsWith('<!--')) {
      if (!text.endsWith('-->')) tags.push(toOtherOccurrence('unclosedComment', match.index, text.length));
    } else if (text.startsWith('<?') || text.startsWith('<![')) {
      tags.push(toOtherOccurrence('xmlOnly', match.index, text.length));
    }
  }
  return tags;
}

/**
 * Pairs start tags with end tags the way Vue's template compiler does, and
 * marks every tag without a partner as escaped: a start tag that is never
 * closed, an end tag with nothing open to close, and any start tags left open
 * inside a pair (`<b><T></b>` escapes `<T>`). Void and self-closing tags need
 * no partner. Void end tags (`</br>`) are never escaped either: they are
 * rewritten instead (see `voidEndTagReplacement`). Matching ignores case.
 *
 * Unclosed comments are always escaped; processing instructions and CDATA
 * are escaped unless an `<svg>` or `<math>` element is open around them.
 *
 * Runs in linear time: each open tag's stack position is also indexed by
 * name, so finding a partner never scans the stack, and every tag is pushed
 * and popped at most once.
 */
export function markUnbalanced(tags: readonly TagOccurrence[]): void {
  const openTags: TagOccurrence[] = [];
  const openIndexesByName = new Map<string, number[]>();

  const popOpenTag = (): TagOccurrence => {
    const openTag = openTags.pop()!;
    openIndexesByName.get(openTag.name)!.pop();
    return openTag;
  };

  const isInXmlContext = () => XML_CONTEXT_TAGS.some((name) => openIndexesByName.get(name)?.length);

  for (const tag of tags) {
    if (tag.kind === 'unclosedComment') {
      tag.isEscaped = true;
      continue;
    }
    if (tag.kind === 'xmlOnly') {
      tag.isEscaped = !isInXmlContext();
      continue;
    }
    if (tag.isSelfClosing) continue;
    if (!tag.isClosing) {
      if (VOID_TAG_NAMES.has(tag.name)) continue;
      const openIndexes = openIndexesByName.get(tag.name) ?? [];
      openIndexes.push(openTags.length);
      openIndexesByName.set(tag.name, openIndexes);
      openTags.push(tag);
      continue;
    }
    if (VOID_TAG_NAMES.has(tag.name)) continue;
    const openIndex = openIndexesByName.get(tag.name)?.at(-1);
    if (openIndex === undefined) {
      tag.isEscaped = true;
      continue;
    }
    while (openTags.length > openIndex + 1) popOpenTag().isEscaped = true;
    popOpenTag();
  }
  for (const unclosed of openTags) unclosed.isEscaped = true;
}

/**
 * What a void end tag should be written as, or `null` for any other
 * construct. Browsers read `</br>` as `<br>` and ignore other void end tags
 * (`</img>`), as the HTML spec says. Vue doesn't: it drops `</br>` along with
 * the rest, and fails the compile on one in upper case (`</BR>`). Writing
 * them the way a browser reads them keeps the line break and the build.
 */
export function voidEndTagReplacement(tag: TagOccurrence): string | null {
  if (tag.kind !== 'tag' || !tag.isClosing || !VOID_TAG_NAMES.has(tag.name)) return null;
  return tag.name === 'br' ? '<br>' : '';
}

/** One replacement in a string: `length` characters at `offset` become `text`. */
export interface Edit {
  offset: number;
  length: number;
  text: string;
}

/** Applies non-overlapping edits, given in any order, to `html`. */
export function applyEdits(html: string, edits: readonly Edit[]): string {
  const parts: string[] = [];
  let start = 0;
  for (const edit of [...edits].sort((a, b) => a.offset - b.offset)) {
    parts.push(html.slice(start, edit.offset), edit.text);
    start = edit.offset + edit.length;
  }
  parts.push(html.slice(start));
  return parts.join('');
}

/** The edit that escapes a construct's `<` as `&lt;`, so it reads as text. */
export const escapeEdit = (tag: TagOccurrence): Edit => ({ offset: tag.offset, length: 1, text: '&lt;' });
