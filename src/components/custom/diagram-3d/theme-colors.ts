/**
 * Los materiales de three.js reciben un color concreto, no una clase de
 * Tailwind — así que la regla del módulo 2D ("colores por token de tema, nunca
 * hardcodeados") no se puede aplicar igual acá. En vez de clavar hexadecimales
 * en la escena (el error del proyecto original, que no se adaptaba al tema), se
 * leen los mismos tokens de `globals.css` en tiempo de ejecución y se convierten
 * a sRGB. Los tokens están en `oklch()`, que `THREE.Color.setStyle()` no parsea.
 */

const OKLCH = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i;

/** Convierte una cadena `oklch(L C H)` a un entero 0xRRGGBB en sRGB. */
export function oklchToHex(value: string): number | null {
  const match = OKLCH.exec(value.trim());
  if (!match) return null;

  const lightness = match[1].endsWith("%") ? Number.parseFloat(match[1]) / 100 : Number.parseFloat(match[1]);
  const chroma = Number.parseFloat(match[2]);
  const hue = (Number.parseFloat(match[3]) * Math.PI) / 180;
  if (!Number.isFinite(lightness) || !Number.isFinite(chroma) || !Number.isFinite(hue)) return null;

  // OKLCH → OKLab
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab → LMS (se deshace la raíz cúbica del espacio)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  // LMS → sRGB lineal
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const channels = linear.map((c) => {
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  });

  return (channels[0] << 16) | (channels[1] << 8) | channels[2];
}

/** Tokens del tema que usa la escena, con su color de reserva si algo falla. */
const TOKENS = {
  foreground: 0x252525,
  muted: 0xe5e5e5,
  mutedForeground: 0x8e8e8e,
  primary: 0x2f8f5b,
  destructive: 0xe7000b,
  warning: 0xd08700,
  border: 0xe5e5e5,
} as const;

const CSS_VARIABLE: Record<keyof typeof TOKENS, string> = {
  foreground: "--foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  destructive: "--destructive",
  warning: "--warning",
  border: "--border",
};

export type DiagramColors = Record<keyof typeof TOKENS, number>;

/**
 * Lee los tokens del `:root` real del documento, así el mismo código sirve para
 * claro y oscuro sin duplicar la paleta. Si el token no existe o no se puede
 * parsear, cae al valor de reserva en vez de romper la escena.
 */
export function readDiagramColors(): DiagramColors {
  if (typeof window === "undefined") return { ...TOKENS };

  const computed = getComputedStyle(document.documentElement);
  const entries = Object.keys(TOKENS).map((key) => {
    const token = key as keyof typeof TOKENS;
    const raw = computed.getPropertyValue(CSS_VARIABLE[token]);
    return [token, (raw && oklchToHex(raw)) ?? TOKENS[token]] as const;
  });

  return Object.fromEntries(entries) as DiagramColors;
}
