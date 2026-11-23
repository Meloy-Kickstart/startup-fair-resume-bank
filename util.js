/** Trim, collapse whitespace, drop control characters, cap length. */
export const clean = (v, max = 200) =>
  (typeof v === 'string' ? v : '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120;

/** Accept "linkedin.com/in/x" or a full URL; return a safe https URL or ''. */
export function cleanUrl(v) {
  const s = clean(v, 200);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return '';
    return u.toString();
  } catch {
    return '';
  }
}

/** Keep only values from the allowed list. */
export const pick = (v, allowed) => [...new Set([].concat(v || []).filter((x) => allowed.includes(x)))];

export const fileSlug = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .slice(0, 80) || 'resume';

/** Excel runs cells that start with = + - @ as formulas; prefix them so a name cannot become a formula. */
const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(rows, cols) {
  const head = cols.map(([label]) => cell(label)).join(',');
  const body = rows.map((r) => cols.map(([, get]) => cell(typeof get === 'function' ? get(r) : r[get])).join(','));
  return [head, ...body].join('\r\n');
}
