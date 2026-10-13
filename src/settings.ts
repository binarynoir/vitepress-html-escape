import { FRONTMATTER_KEY } from './constants.js';
import type { HtmlEscapeOptions, InterpolationRules, TagRules } from './types.js';

export const TAG_RULES = ['unclosedTags', 'strayEndTags', 'unclosedComments', 'xmlSyntax', 'voidEndTags'] as const;
export const INTERPOLATION_RULES = ['prose', 'code'] as const;

export interface ResolvedSettings {
  tags: Required<TagRules>;
  interpolation: Required<InterpolationRules>;
  hints: boolean;
  asCode: boolean;
}

/**
 * Combines the plugin options with a page's `htmlEscape` frontmatter. The page
 * wins: `htmlEscape: false` turns everything off, and an object overrides only
 * the keys it sets. For `tags` and `interpolation`, `true` or `false` sets
 * every rule in the group and an object sets only the rules it names, so a
 * page can turn one rule back on or off without repeating the rest. Anything
 * else is ignored.
 */
export function resolveSettings(frontmatter: unknown, options: HtmlEscapeOptions = {}): ResolvedSettings {
  const pageValue = isRecord(frontmatter) ? frontmatter[FRONTMATTER_KEY] : undefined;
  if (pageValue === false) {
    return {
      tags: resolveRules(TAG_RULES, false),
      interpolation: resolveRules(INTERPOLATION_RULES, false),
      hints: false,
      asCode: false,
    };
  }

  const page = isRecord(pageValue) ? pageValue : {};
  return {
    tags: resolveRules(TAG_RULES, options.tags, page.tags),
    interpolation: resolveRules(INTERPOLATION_RULES, options.interpolation, page.interpolation),
    hints: toBoolean(page.hints) ?? options.hints ?? false,
    asCode: toBoolean(page.asCode) ?? options.asCode ?? false,
  };
}

/** Every rule on, then each layer applied in turn: a boolean sets all, an object the rules it names. */
function resolveRules<Rule extends string>(rules: readonly Rule[], ...layers: unknown[]): Record<Rule, boolean> {
  const resolved = Object.fromEntries(rules.map((rule) => [rule, true])) as Record<Rule, boolean>;
  for (const layer of layers) {
    if (typeof layer === 'boolean') {
      for (const rule of rules) resolved[rule] = layer;
    } else if (isRecord(layer)) {
      for (const rule of rules) resolved[rule] = toBoolean(layer[rule]) ?? resolved[rule];
    }
  }
  return resolved;
}

/** Whether any rule in a resolved group is on. */
export const anyRule = (rules: Record<string, boolean>): boolean => Object.values(rules).some(Boolean);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
