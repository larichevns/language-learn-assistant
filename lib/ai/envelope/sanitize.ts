/**
 * Injection defense. Every user-authored field entering an envelope passes
 * through `sanitize()` and is wrapped in `<data type="…">…</data>`. The system
 * prompt declares `<data>` contents inert.
 *
 * Order is load-bearing:
 *   1) NFKC — folds fullwidth `＜＞＆` to ASCII `< > &`
 *   2) strip C0/C1 control chars
 *   3) escape `& < >` (AFTER the fold, so a pasted `＜/data＞` becomes `&lt;/data&gt;`)
 *   4) trim
 * Reversing 1 and 3 would let a fullwidth `＜/data＞` break out of the wrapper.
 */
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;

export function sanitize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

export function wrapData(
  type: string,
  value: unknown,
  attrs: Record<string, string> = {},
): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${sanitize(k)}="${sanitize(v)}"`)
    .join('');
  return `<data type="${sanitize(type)}"${attrStr}>${sanitize(String(value))}</data>`;
}
