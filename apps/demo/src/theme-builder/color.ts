export type RGB = readonly [number, number, number];
export type Oklch = readonly [number, number, number];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const linear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

export const rgbToOklch = (rgb: RGB): Oklch => {
  const [r, g, b] = rgb.map(linear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360];
};
export const oklchToRgb = ([L, c, h]: Oklch): RGB => {
  const a = c * Math.cos((h * Math.PI) / 180),
    b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map(clamp) as unknown as RGB;
};
export const oklch = (l: number, c: number, h: number): string =>
  `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${((h + 360) % 360).toFixed(2)})`;

/** Supported editable syntax is hex, RGB(A), and OKLCH, including CSS percentage channels. */
export const parseColor = (value: string): RGB | undefined => {
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(text)) {
    const hex = text.length === 4 ? [...text.slice(1)].map((x) => x + x).join("") : text.slice(1);
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as RGB;
  }
  const match = /^(oklch|rgba?|color)\(([^)]+)\)$/.exec(text);
  if (!match) return undefined;
  const parts = match[2]!
    .replace(/^srgb\s+/, "")
    .split(/\s*[,/]\s*|\s+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return undefined;
  const channels = parts.map((x) => Number(x.replace(/%|deg/g, "")));
  if (channels.some((x) => !Number.isFinite(x))) return undefined;
  if (match[1] === "oklch") {
    const [l, c, h] = channels as [number, number, number];
    const L = parts[0]!.endsWith("%") ? l / 100 : l;
    const C = parts[1]!.endsWith("%") ? c * 0.004 : c;
    if (L < 0 || L > 1 || C < 0 || C > 0.5) return undefined;
    return oklchToRgb([L, C, h]);
  }
  return channels
    .slice(0, 3)
    .map((x, i) =>
      clamp(parts[i]!.endsWith("%") ? x / 100 : match[1] === "color" ? x : x / 255),
    ) as unknown as RGB;
};
export const toHex = (value: string): string => {
  const rgb = parseColor(value) ?? [0, 0, 0];
  return `#${rgb
    .map((x) =>
      Math.round(clamp(x) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
export const luminance = (rgb: RGB): number =>
  linear(rgb[0]) * 0.2126 + linear(rgb[1]) * 0.7152 + linear(rgb[2]) * 0.0722;
export const contrast = (foreground: string, background: string): number | undefined => {
  const fg = parseColor(foreground),
    bg = parseColor(background);
  if (!fg || !bg) return undefined;
  const a = luminance(fg),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
export const contrastLabel = (ratio: number | undefined): string =>
  ratio === undefined ? "—" : ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : `${ratio.toFixed(2)}:1`;
export const readableForeground = (background: string): string =>
  (contrast("#ffffff", background) ?? 0) >= (contrast("#000000", background) ?? 0)
    ? "#ffffff"
    : "#000000";
