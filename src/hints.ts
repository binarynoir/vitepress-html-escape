import type { TagOccurrence } from './balanceTags.js';
import { escapeInterpolation } from './interpolation.js';

/** Class on every hint, plus `html-escape-hint--<level>`. */
export const HINT_CLASS = 'html-escape-hint';

/**
 * How serious a hint is. `error`: markup that would have failed the build or
 * hidden content, shown as text instead. `warning`: something the plugin
 * corrected or escaped that may still need a look.
 */
export type HintLevel = 'error' | 'warning';

/** Where a hint points in the source: a 1-based line, and the file under VitePress. */
export interface HintLocation {
  line?: number;
  file?: string;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Wraps `source`, shown as text, in a hint span carrying `message`. The
 * client script (`enableHtmlEscapeHints`) underlines it and shows the
 * message in a popover.
 */
export function hintMarkup(source: string, level: HintLevel, message: string, location: HintLocation): string {
  const attributes = [
    `class="${HINT_CLASS} ${HINT_CLASS}--${level}"`,
    `data-html-escape-hint="${escapeHtml(message)}"`,
    location.line === undefined ? '' : `data-html-escape-hint-line="${location.line}"`,
    location.file === undefined ? '' : `data-html-escape-hint-file="${escapeHtml(location.file)}"`,
  ].filter(Boolean);
  return `<span ${attributes.join(' ')}>${escapeInterpolation(escapeHtml(source))}</span>`;
}

/** The tag name as written in `source`, such as `T` in `<T>` or `div` in `</div>`. */
const writtenName = (source: string): string => /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(source)?.[1] ?? '';

/** Explains why a construct was escaped and how to fix it. */
export function escapeMessage(tag: TagOccurrence, source: string): string {
  if (tag.kind === 'unclosedComment') {
    return 'This `<!--` is never closed with `-->`, so it is shown as text instead of hiding the rest of the page. Add `-->` where the comment should end.';
  }
  if (tag.kind === 'xmlOnly') {
    return 'Vue only allows processing instructions (`<?…?>`) and CDATA sections inside `<svg>` or `<math>`, so this is shown as text. Wrap it in backticks to show it as code.';
  }
  const name = writtenName(source);
  if (tag.isClosing) {
    return `\`</${name}>\` has no matching \`<${name}>\` to close, so it is shown as text. Delete it, add the opening tag, or wrap it in backticks if it is meant as text.`;
  }
  return `\`<${name}>\` is never closed, so it is shown as text. If it is code or a placeholder, put it in backticks so it shows as code. If it is an element, add \`</${name}>\`.`;
}

/** Explains a void end tag that was rewritten (`</br>`) or removed (`</img>`). */
export function voidEndTagMessage(tag: TagOccurrence, source: string): string {
  const name = writtenName(source);
  if (tag.name === 'br') {
    return `\`</${name}>\` is not valid HTML, so it was rendered as a line break. Write \`<br>\` instead.`;
  }
  return `\`<${name}>\` never takes an end tag, so \`</${name}>\` has no effect and was removed. Delete it.`;
}

export const INTERPOLATION_MESSAGE =
  'Vue would evaluate `{{ }}` as an expression, so it is shown as written. Wrap it in backticks to show it as code. If the page should evaluate it, set `htmlEscape: { interpolation: false }` in its frontmatter.';

/** The 1-based line of `offset` in `content`, given the 0-based line `content` starts on. */
export function lineAt(startLine: number | undefined, content: string, offset: number): number | undefined {
  if (startLine === undefined) return undefined;
  let line = startLine + 1;
  for (let index = content.indexOf('\n'); index !== -1 && index < offset; index = content.indexOf('\n', index + 1)) {
    line++;
  }
  return line;
}
