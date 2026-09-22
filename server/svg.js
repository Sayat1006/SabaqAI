/**
 * Defensive clean-up for model-generated SVG. The app only ever shows these through <img>
 * (where scripts never run) and serves them with a locked-down CSP, so this is a second layer:
 * drop anything that is not a known static drawing element or a safe attribute.
 */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'pattern', 'use', 'title', 'desc', 'mask', 'symbol',
]);
const BLOCKED_WITH_CONTENT = /<(script|style|foreignObject|iframe|image|animate\w*|set)\b[\s\S]*?(<\/\1\s*>|\/>)/gi;

export function sanitizeSvg(input) {
  if (typeof input !== 'string') return null;
  let svg = input.trim();
  const start = svg.search(/<svg\b/i);
  const end = svg.toLowerCase().lastIndexOf('</svg>');
  if (start < 0 || end < 0) return null;
  svg = svg.slice(start, end + 6);

  svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(BLOCKED_WITH_CONTENT, '');

  svg = svg.replace(/<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^>]*?)(\/?)\s*>/g, (_m, close, tag, attrs, selfClose) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return '';
    if (close) return `</${tag}>`;
    const safe = [];
    const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    let m;
    while ((m = re.exec(attrs))) {
      const name = m[1];
      const value = m[2].slice(1, -1);
      const lower = name.toLowerCase();
      if (lower.startsWith('on')) continue;
      if (/javascript:|data:|url\(\s*['"]?(?!#)/i.test(value)) continue;
      if ((lower === 'href' || lower === 'xlink:href') && !value.startsWith('#')) continue;
      if (lower === 'style' && /expression|@import|url\(/i.test(value)) continue;
      safe.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }
    return `<${tag}${safe.length ? ' ' + safe.join(' ') : ''}${selfClose ? '/' : ''}>`;
  });

  if (!/^<svg\b/i.test(svg)) return null;
  if (!/xmlns=/.test(svg.slice(0, 200))) svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}
