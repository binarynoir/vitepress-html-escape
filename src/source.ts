import type { MarkdownIt, StateCore } from 'markdown-it';

// The full source handed to `md.parse` for each render, keyed by its env.
const sources = new WeakMap<object, string>();
// Line offsets of blocks re-parsed as Markdown, keyed by their nested state.
const nestedOffsets = new WeakMap<StateCore, number>();

/**
 * Records the source each render starts from. VitePress strips the
 * frontmatter in its own `md.parse` wrapper before parsing, so token line
 * maps count from the end of the frontmatter. This wrapper is installed
 * later, from `markdown.config`, so it runs first and sees the whole file.
 */
export function recordSource(md: MarkdownIt): void {
  const parse = md.parse.bind(md);
  md.parse = (src, env) => {
    if (typeof env === 'object' && env !== null) sources.set(env, src);
    return parse(src, env);
  };
}

/** Marks `nested` as parsing a block that starts `offset` lines into its file. */
export function setNestedLineOffset(nested: StateCore, offset: number): void {
  nestedOffsets.set(nested, offset);
}

/**
 * How many lines of the source file come before line 0 of this state's
 * token maps: the frontmatter VitePress stripped (`env.content` is what it
 * parsed), plus, for a re-parsed block, where the block starts.
 */
export function lineOffset(state: StateCore): number {
  const nested = nestedOffsets.get(state);
  if (nested !== undefined) return nested;
  const source = sources.get(state.env);
  const content = state.env?.content;
  if (source === undefined || typeof content !== 'string' || !source.endsWith(content)) return 0;
  return source.slice(0, source.length - content.length).split('\n').length - 1;
}
