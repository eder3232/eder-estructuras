/**
 * Un operando de una sustitución numérica, entre paréntesis si es negativo.
 *
 * Sin esto la fila se lee `−-0.6000×0.0000` o `F = 4 × -0.3293`: el signo fijo
 * de la fórmula pegado al signo del número. Apareció en los tres sistemas, uno
 * por uno (`/armaduras-2d` en `a4aabf3`, `/springs` y `/armaduras-3d` en sus
 * revisiones para la v1), y por eso vive acá y no copiado en cada tabla.
 */
export function operand(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return text.startsWith("-") ? `(${text})` : text;
}
