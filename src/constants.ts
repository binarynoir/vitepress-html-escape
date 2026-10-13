/**
 * HTML elements that never take an end tag. Vue accepts these unclosed, so
 * `<br>` and `<img src="...">` are always left as written.
 */
export const VOID_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
] as const;

/**
 * Elements whose contents Vue reads as plain text, not markup. Tags written
 * inside them (`ref<string>()` in a `<script setup>`) are never escaped.
 */
export const RAW_TEXT_TAGS = ['script', 'style', 'textarea', 'title'] as const;

/**
 * Elements Vue parses in XML mode, where processing instructions and CDATA
 * sections are allowed. Everywhere else they fail the compile.
 */
export const XML_CONTEXT_TAGS = ['svg', 'math'] as const;

/** Frontmatter key a page uses to turn escaping off or tune it. */
export const FRONTMATTER_KEY = 'htmlEscape';
