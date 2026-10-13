/**
 * Escapes `{` in rendered text so Vue never sees a `{{` delimiter. The entity
 * looks identical on the page, and VitePress already does the same for code.
 */
export function escapeInterpolation(html: string): string {
  return html.replace(/\{/g, '&#123;');
}

/**
 * Escapes `{` in the text of rendered HTML, leaving tags and their attributes
 * as they are. For renderer output such as `<code class="x">{{ a }}</code>`,
 * where markdown-it has already escaped `<` and `>` in the text and in
 * attribute values.
 */
export function escapeInterpolationInText(html: string): string {
  return html.replace(/(<[^>]*>)|\{/g, (_match, tag?: string) => tag ?? '&#123;');
}
