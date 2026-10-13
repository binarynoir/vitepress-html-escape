/**
 * Escapes `{` in rendered text so Vue never sees a `{{` delimiter. The entity
 * looks identical on the page, and VitePress already does the same for code.
 */
export function escapeInterpolation(html: string): string {
  return html.replace(/\{/g, '&#123;');
}
