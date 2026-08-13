"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "./diagram-label";
import { useDiagramScale } from "./scale-context";
import { projectPoint } from "./viewbox";

interface MomentArcProps {
  x: number;
  z: number;
  value: number;
  unitSize: number;
  variant: "force" | "reaction";
}

const COLOR_CLASS = {
  force: "stroke-blue-500 fill-blue-500",
  reaction: "stroke-warning fill-warning",
} as const;

/** Punto del arco en coordenadas SVG, con θ medido en sentido antihorario en pantalla. */
function pointAt(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
}

/**
 * Un momento no es un vector con dirección en el plano: dibujarlo como flecha
 * recta lo confundiría con una fuerza. Se dibuja como arco de 270° alrededor
 * del nudo, antihorario si el valor es positivo (mismo criterio de signo que
 * el DOF rotacional del motor: giro de +x hacia +z).
 */
export function MomentArc({ x, z, value, unitSize, variant }: MomentArcProps) {
  const decimals = useDecimals();
  const scale = useDiagramScale();
  if (value === 0) return null;

  const { x: cx, y: cy } = projectPoint({ x, z });
  const radius = unitSize * 1.2;
  const counterClockwise = value > 0;

  const startAngle = counterClockwise ? -45 : 225;
  const endAngle = counterClockwise ? 225 : -45;
  const start = pointAt(cx, cy, radius, startAngle);
  const end = pointAt(cx, cy, radius, endAngle);
  // El barrido de SVG se mide con y hacia abajo: 1 es horario en pantalla.
  const sweepFlag = counterClockwise ? 0 : 1;

  const endRadians = (endAngle * Math.PI) / 180;
  const tangentSign = counterClockwise ? 1 : -1;
  const tangent = {
    x: tangentSign * -Math.sin(endRadians),
    y: tangentSign * -Math.cos(endRadians),
  };
  const perp = { x: -tangent.y, y: tangent.x };

  const headSize = unitSize * 0.35;
  const tip = { x: end.x + tangent.x * headSize, y: end.y + tangent.y * headSize };
  const base = { x: end.x - tangent.x * headSize * 0.6, y: end.y - tangent.y * headSize * 0.6 };

  return (
    <g className={COLOR_CLASS[variant]}>
      <path
        d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 1 ${sweepFlag} ${end.x} ${end.y}`}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* Maciza: sin `stroke-none` hereda el color del grupo con el ancho
          inicial (1 unidad del modelo, no 1 px). */}
      <polygon
        points={`${tip.x},${tip.y} ${base.x + perp.x * headSize},${base.y + perp.y * headSize} ${base.x - perp.x * headSize},${base.y - perp.y * headSize}`}
        className="stroke-none"
      />
      {/* Arriba y a la izquierda del arco, no centrado sobre el nudo.
          Un empotramiento tiene las tres reacciones en el mismo nudo, y las
          etiquetas de las flechas rectas salen para el otro lado (las
          verticales al costado derecho de su punta, las horizontales por
          debajo de su eje). Centrado sobre el nudo, el momento se superponía
          con la reacción vertical — visible en los dos apoyos de `/frame2d`. */}
      <DiagramLabel
        x={cx - radius - unitSize * 0.35}
        y={cy - radius - unitSize * 0.35}
        unitSize={unitSize}
        anchor="end"
      >
        {scale.format(value, decimals)}
      </DiagramLabel>
    </g>
  );
}
