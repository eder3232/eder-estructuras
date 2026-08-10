import type { ViewBox } from "./viewbox";

/**
 * Longitud de referencia (en unidades del viewBox) para radios de nodo, tamaño
 * de ícono/flecha y fuente — análoga al sphereSize/textHeight relativos al
 * tamaño de la figura que usaba el proyecto original, calculada una sola vez
 * por diagrama en vez de hardcodear un tamaño fijo en píxeles.
 */
export function computeUnitSize(box: ViewBox): number {
  return Math.max(box.width, box.height) / 40;
}
