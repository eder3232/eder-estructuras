export interface SvgPoint {
  x: number;
  y: number;
}

export interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * El eje estructural z crece hacia arriba; el eje y de SVG crece hacia abajo.
 * Todo el resto del módulo trabaja en coordenadas ya proyectadas (svg), nunca en x/z crudos.
 */
export function projectPoint({ x, z }: { x: number; z: number }): SvgPoint {
  return { x, y: -z };
}

export function computeViewBox(points: SvgPoint[], paddingRatio = 0.15): ViewBox {
  if (points.length === 0) {
    return { minX: -1, minY: -1, width: 2, height: 2 };
  }

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const pad = Math.max(width, height) * paddingRatio;

  return { minX: minX - pad, minY: minY - pad, width: width + 2 * pad, height: height + 2 * pad };
}

export function viewBoxAttr(box: ViewBox): string {
  return `${box.minX} ${box.minY} ${box.width} ${box.height}`;
}
