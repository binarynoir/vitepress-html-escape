import { FRONTMATTER_KEY } from './constants.js';
import type { HtmlEscapeOptions } from './types.js';

export type ResolvedSettings = Required<HtmlEscapeOptions>;

/**
 * Combines the plugin options with a page's `htmlEscape` frontmatter. The page
 * wins: `htmlEscape: false` turns everything off, and an object overrides only
 * the keys it sets. Anything else in the frontmatter is ignored.
 */
export function resolveSettings(frontmatter: unknown, options: HtmlEscapeOptions = {}): ResolvedSettings {
  const pageValue = isRecord(frontmatter) ? frontmatter[FRONTMATTER_KEY] : undefined;
  if (pageValue === false) return { tags: false, interpolation: false };

  const page = isRecord(pageValue) ? pageValue : {};
  return {
    tags: toBoolean(page.tags) ?? options.tags ?? true,
    interpolation: toBoolean(page.interpolation) ?? options.interpolation ?? true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
