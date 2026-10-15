import { useSyncExternalStore } from "react";

/**
 * Los materiales de three.js reciben un color concreto, no una clase de
 * Tailwind — así que la regla del módulo 2D ("colores por token de tema, nunca
 * hardcodeados") no se puede aplicar igual acá. En vez de clavar hexadecimales
 * en la escena (el error del proyecto original, que no se adaptaba al tema), se
 * leen los mismos tokens de `globals.css` en tiempo de ejecución.
 *
 * **Quien convierte el color es el navegador, no este archivo.** Hasta el
 * 2026-10-15 había acá un conversor `oklch → sRGB` escrito a mano, con tests
 * que pasaban — y la escena **nunca** siguió al tema: Tailwind v4 compila los
 * tokens a `lab(...)`, `getComputedStyle` devuelve eso, el conversor no lo
 * reconocía, y todos los colores caían a la reserva, que es la paleta clara. En
 * oscuro, barras casi negras sobre fondo negro. Los tests probaban el formato
 * que está en `globals.css`, no el que llega al navegador.
 *
 * Así que ahora el color se pinta en un lienzo 2D de 1×1 y se leen los bytes:
 * el navegador entiende cualquier formato que él mismo produzca, hoy y cuando
 * cambie la compilación.
 */

/** Tokens del tema que usa la escena, con su color de reserva si algo falla. */
const FALLBACK = {
  background: 0xffffff,
  foreground: 0x252525,
  muted: 0xe5e5e5,
  mutedForeground: 0x8e8e8e,
  primary: 0x2f8f5b,
  destructive: 0xe7000b,
  warning: 0xd08700,
  border: 0xe5e5e5,
} as const;

const CSS_VARIABLE: Record<keyof typeof FALLBACK, string> = {
  background: "--background",
  foreground: "--foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  destructive: "--destructive",
  warning: "--warning",
  border: "--border",
};

export type DiagramColors = Record<keyof typeof FALLBACK, number>;

export type Rgba = readonly [number, number, number, number];

/**
 * Compone un color con transparencia sobre un fondo opaco y devuelve
 * `0xRRGGBB`. Hace falta porque un material de three.js no tiene alfa por
 * token: `--border` en oscuro es blanco al 10%, y sin componerlo la grilla del
 * piso sale **blanca pura**, lo más fuerte de toda la escena.
 */
export function compositeOver([r, g, b, a]: Rgba, background: number): number {
  const alpha = a / 255;
  const channel = (value: number, shift: number) =>
    Math.round(value * alpha + ((background >> shift) & 0xff) * (1 - alpha));
  return (channel(r, 16) << 16) | (channel(g, 8) << 8) | channel(b, 0);
}

/** Dos centinelas distintos: si el color no se entiende, `fillStyle` no cambia. */
const SENTINEL = "#010203";

function resolveCssColor(context: CanvasRenderingContext2D, value: string): Rgba | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  context.fillStyle = SENTINEL;
  context.fillStyle = trimmed;
  if (context.fillStyle === SENTINEL && trimmed !== SENTINEL) return null;

  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a];
}

/**
 * Lee los tokens del `:root` real del documento, así el mismo código sirve para
 * claro y oscuro sin duplicar la paleta. Si un token no existe o no se puede
 * resolver, cae a la reserva en vez de romper la escena.
 */
export function readDiagramColors(): DiagramColors {
  if (typeof window === "undefined") return { ...FALLBACK };

  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) return { ...FALLBACK };
  context.canvas.width = 1;
  context.canvas.height = 1;

  const computed = getComputedStyle(document.documentElement);
  const read = (token: keyof typeof FALLBACK) => resolveCssColor(context, computed.getPropertyValue(CSS_VARIABLE[token]));

  // El fondo primero: es contra lo que se compone todo lo que tenga alfa.
  const backgroundRgba = read("background");
  const background = backgroundRgba ? compositeOver(backgroundRgba, FALLBACK.background) : FALLBACK.background;

  const entries = (Object.keys(FALLBACK) as (keyof typeof FALLBACK)[]).map((token) => {
    const rgba = token === "background" ? backgroundRgba : read(token);
    return [token, rgba ? compositeOver(rgba, background) : FALLBACK[token]] as const;
  });

  return Object.fromEntries(entries) as DiagramColors;
}

/*
 * Suscripción al tema. Los colores se tienen que releer cuando `next-themes`
 * cambia la clase de `<html>`, no cuando React vuelve a renderizar: la clase
 * cambia en un efecto, después del render, así que un `useMemo` atado al tema
 * leería los tokens del tema anterior. Se observa la clase misma.
 */

let cachedKey: string | null = null;
let cachedColors: DiagramColors = { ...FALLBACK };
const serverColors: DiagramColors = { ...FALLBACK };

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}

function getSnapshot(): DiagramColors {
  const root = document.documentElement;
  const key = `${root.className}|${root.getAttribute("style") ?? ""}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedColors = readDiagramColors();
  }
  return cachedColors;
}

/** Los colores del tema actual, que cambian cuando cambia el tema. */
export function useDiagramColors(): DiagramColors {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverColors);
}
