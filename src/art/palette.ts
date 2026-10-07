/**
 * Colour math for deck styles: hex <-> OKLCH, and a memoised "painter" that
 * rewrites every lowercase 6-digit hex colour in a chunk of SVG markup.
 *
 * Convention: art colours are lowercase hex. Colours that must survive a
 * repaint (style overlays, chips) are written in UPPERCASE hex, which the
 * painter leaves alone. Short hex (#000, #fff: shadows and highlights) is
 * never touched either.
 */

export type Lch = [number, number, number];

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToLch(hex: string): Lch {
  const n = parseInt(hex.slice(1), 16);
  const r = toLin(((n >> 16) & 255) / 255);
  const g = toLin(((n >> 8) & 255) / 255);
  const b = toLin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

function lchToRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = ([r, g, b]: [number, number, number]) => r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;

/** OKLCH to hex; out-of-gamut colours lose chroma (keeping lightness and hue). */
export function lchToHex(L: number, C: number, h: number): string {
  L = Math.min(1, Math.max(0, L));
  C = Math.max(0, C);
  let rgb = lchToRgb(L, C, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToRgb(L, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = lchToRgb(L, lo, h);
  }
  const hx = (v: number) => {
    const n = Math.round(Math.min(1, Math.max(0, toGam(Math.min(1, Math.max(0, v))))) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${hx(rgb[0])}${hx(rgb[1])}${hx(rgb[2])}`;
}

/** Shortest-path hue blend. */
export function mixHue(a: number, b: number, t: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return (a + d * t + 360) % 360;
}

/** Hue distance in degrees (0–180). */
export const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** OKLab distance with an optional chroma weight. */
export function labDist(p: Lch, q: Lch, wl = 1): number {
  const pa = p[1] * Math.cos((p[2] * Math.PI) / 180);
  const pb = p[1] * Math.sin((p[2] * Math.PI) / 180);
  const qa = q[1] * Math.cos((q[2] * Math.PI) / 180);
  const qb = q[1] * Math.sin((q[2] * Math.PI) / 180);
  return Math.hypot((p[0] - q[0]) * wl, pa - qa, pb - qb);
}

const HEX = /#[0-9a-f]{6}(?![0-9A-Za-z_-])/g;

/** A memoised markup recolourer for one colour function. */
export function painter(fn: (hex: string) => string): (markup: string) => string {
  const memo = new Map<string, string>();
  const one = (m: string) => {
    let v = memo.get(m);
    if (v === undefined) {
      v = fn(m);
      memo.set(m, v);
    }
    return v;
  };
  return (markup: string) => markup.replace(HEX, one);
}
