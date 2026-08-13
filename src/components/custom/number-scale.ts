import { atom } from "jotai";

/**
 * Notación compacta: un factor común por matriz en vez de repetir la magnitud
 * en cada celda.
 *
 * **De dónde sale el problema.** Una matriz de rigidez tiene todos sus valores
 * en el mismo orden (`EA/L` y sus múltiplos), así que con 4 decimales cada celda
 * mide nueve caracteres —`6666.6667`— y las nueve repiten los mismos cuatro
 * dígitos de escala. Como la matriz global es de `DOF × DOF`, ese ancho por
 * celda se multiplica por la cantidad de nudos: 20 nudos de armadura 2D son 40
 * columnas, unos 3700 px. Sacar la escala afuera pasa la celda de ~92 px a ~58,
 * o sea **casi la mitad del ancho a cualquier tamaño**.
 *
 * No es solo compresión: en un vector de desplazamientos, `0.0025` frente a
 * `2.5 ×10⁻³` dice lo mismo con más señal, porque los ceros a la izquierda no
 * son información.
 *
 * Se puede apagar (`atomCompactNumbers`), que es el caso de cotejar contra un
 * ejercicio resuelto a mano.
 */
export const atomCompactNumbers = atom(true);

/**
 * Exponente (múltiplo de 3, notación de ingeniería) que conviene sacar afuera de
 * una matriz, o `0` si no conviene ninguno.
 *
 * La banda `[0.01, 1000)` se deja como está: son números que ya se leen de
 * corrido, y factorearlos sería ruido. El múltiplo de 3 es para que el factor
 * caiga siempre en una unidad que alguien nombra (kilo, mega, mili).
 */
export function scaleExponent(values: readonly number[]): number {
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const magnitude = Math.abs(value);
    if (magnitude > max) max = magnitude;
  }

  if (max === 0) return 0;
  if (max >= 0.01 && max < 1000) return 0;
  return 3 * Math.floor(Math.log10(max) / 3);
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

/** `3` → `×10³`. Devuelve `null` cuando no hay factor que mostrar. */
export function scaleLabel(exponent: number): string | null {
  if (exponent === 0) return null;
  const digits = [...String(exponent)].map((c) => SUPERSCRIPT[c] ?? c).join("");
  return `×10${digits}`;
}

/** El valor tal como va en la celda, ya dividido por el factor de la matriz. */
export function formatScaled(value: number, decimals: number, exponent: number): string {
  const scaled = exponent === 0 ? value : value / 10 ** exponent;
  // `-0.0000` es ruido: aparece por el redondeo de un cero negativo del cálculo.
  const fixed = scaled.toFixed(decimals);
  return fixed === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : fixed;
}
