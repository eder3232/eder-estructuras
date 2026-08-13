import type { SvgPoint } from "./viewbox";

export interface AxialLabelPlacement extends SvgPoint {
  anchor: "start" | "middle" | "end";
}

/**
 * Dónde va el número de la fuerza axial de una barra.
 *
 * **Al 25% del recorrido y no en el medio**, que es la misma posición que usa el
 * esquema para el nombre de la barra —y que ya usaba el proyecto original—. No
 * es estética: en la armadura semilla las dos diagonales se cruzan **justo en su
 * punto medio**, así que dos números centrados quedarían uno encima del otro. Al
 * 25% cada uno cae en su propia mitad.
 *
 * Corrido perpendicular a la barra **hacia afuera de la figura**, para que el
 * número no quede tachado por ella. El "hacia afuera" se mide contra el centro
 * del diagrama, y no es la primera regla que se probó: la anterior corría la
 * etiqueta siempre hacia arriba en pantalla, que en una barra casi vertical no
 * quiere decir nada — ahí la componente vertical de la perpendicular es ~0 y su
 * signo lo decide el ruido. Se vio en la captura: un desplazamiento de milésimas
 * en un nudo alcanzó para dar vuelta el lado de una barra y apilar su número
 * sobre el de la barra de al lado.
 *
 * **El ancla es la otra mitad del corrimiento, y sin ella no alcanza.** Un
 * número de siete caracteres mide unas 4 unidades de ancho y el corrimiento es
 * de 0.8: centrado, el texto vuelve a cruzar su propia barra por más que se lo
 * corra. En las barras más verticales que horizontales el número se ancla por el
 * extremo que da a la barra y crece hacia afuera; en las horizontales el
 * corrimiento vertical ya alcanza, porque ahí lo que mide poco es el alto.
 *
 * Todo en coordenadas SVG ya proyectadas (y hacia abajo).
 */
export function axialLabelPoint(
  a: SvgPoint,
  b: SvgPoint,
  unitSize: number,
  center: SvgPoint,
): AxialLabelPlacement {
  const at = 0.25;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;

  const anchorX = a.x + at * dx;
  const anchorY = a.y + at * dy;

  let perpX = -dy / length;
  let perpY = dx / length;
  // Hacia el lado opuesto al centro. Si el punto cae justo en el centro, el
  // producto escalar da 0 y queda la orientación de partida, que sirve igual.
  if (perpX * (anchorX - center.x) + perpY * (anchorY - center.y) < 0) {
    perpX = -perpX;
    perpY = -perpY;
  }

  const offset = unitSize * 0.8;
  return {
    x: anchorX + perpX * offset,
    y: anchorY + perpY * offset,
    anchor: Math.abs(dy) > Math.abs(dx) ? (perpX > 0 ? "start" : "end") : "middle",
  };
}
