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

/**
 * El margen no es estético: **tiene que entrar la etiqueta más larga**, que
 * cuelga por fuera del último nudo. El peor caso es una reacción horizontal en
 * el nudo del borde — flecha (2.2 unidades) + separación (0.55) + un número de
 * siete caracteres en monoespaciada (7 × 0.6 = 4.2) ≈ 7 unidades.
 *
 * Y el número no sale de una regla de tres, porque **el margen se muerde la
 * cola**: la unidad es `max(ancho, alto)/40` del viewBox *ya padeado*, así que
 * agrandar el margen agranda la unidad y con ella el texto que hay que meter
 * adentro. Con `u = max·(1+2p)/40`, pedir `p·max ≥ 6.95·u` da `p ≥ 0.266`.
 *
 * Con el 15% de antes el número quedaba **cortado por el borde del lienzo**. Se
 * vio en la forma deformada de `/frame2d` —la primera vez que se la miró—, y no
 * era nuevo: en `/armaduras-2d` venía entrando por muy poco. Un texto cortado es
 * ilegible igual que uno superpuesto, así que es el mismo problema que resuelven
 * el corrimiento de las etiquetas y el halo.
 */
export function computeViewBox(points: SvgPoint[], paddingRatio = 0.28): ViewBox {
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
