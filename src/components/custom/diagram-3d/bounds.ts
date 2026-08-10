import type { Point3 } from "./types";

export interface Bounds3D {
  min: Point3;
  max: Point3;
  center: Point3;
  /** Radio de la esfera que envuelve la figura — la distancia base de la cámara. */
  radius: number;
  /** Mayor dimensión del bounding box; base de `computeUnitSize`. */
  extent: number;
}

/**
 * Análogo 3D de `computeViewBox` del módulo 2D, con una diferencia: acá no hay
 * proyección de coordenadas. El eje estructural z crece hacia arriba y la
 * escena usa z como eje vertical (`camera.up = (0,0,1)`), así que las
 * coordenadas del dominio entran a three.js tal cual, sin remapear ejes.
 */
export function computeBounds(points: Point3[]): Bounds3D {
  if (points.length === 0) {
    return { min: [-1, -1, -1], max: [1, 1, 1], center: [0, 0, 0], radius: 1, extent: 2 };
  }

  const min: Point3 = [Infinity, Infinity, Infinity];
  const max: Point3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (const axis of [0, 1, 2] as const) {
      min[axis] = Math.min(min[axis], p[axis]);
      max[axis] = Math.max(max[axis], p[axis]);
    }
  }

  const center: Point3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const size: Point3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const extent = Math.max(size[0], size[1], size[2], 1e-6);
  const radius = Math.max(Math.hypot(size[0], size[1], size[2]) / 2, extent * 0.5);

  return { min, max, center, radius, extent };
}

/**
 * Longitud de referencia para radios de nudo, tamaño de flechas y glifos de
 * apoyo — mismas proporciones que `computeUnitSize` del módulo 2D, para que un
 * sistema no se vea con nudos gigantes y otro con nudos diminutos.
 */
export function computeUnitSize(bounds: Bounds3D): number {
  return bounds.extent / 40;
}
