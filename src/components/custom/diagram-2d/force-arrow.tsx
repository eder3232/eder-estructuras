"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { projectPoint } from "./viewbox";

interface ForceArrowProps {
  x: number;
  z: number;
  axis: "x" | "z";
  value: number;
  unitSize: number;
  /** "force" = carga aplicada (azul); "reaction" = reacción calculada (color de aviso) — distingue visualmente el dato que el usuario ingresó del que el motor resolvió. */
  variant: "force" | "reaction";
}

const COLOR_CLASS = {
  force: "stroke-blue-500 fill-blue-500",
  reaction: "stroke-warning fill-warning",
} as const;

export function ForceArrow({ x, z, axis, value, unitSize, variant }: ForceArrowProps) {
  const decimals = useDecimals();
  if (value === 0) return null;

  const { x: tailX, y: tailY } = projectPoint({ x, z });
  const dir =
    axis === "x" ? { x: value >= 0 ? 1 : -1, y: 0 } : { x: 0, y: value >= 0 ? -1 : 1 };

  const length = unitSize * 2.2;
  const headX = tailX + dir.x * length;
  const headY = tailY + dir.y * length;

  const headSize = unitSize * 0.35;
  // Perpendicular al vector dirección, para la base del triángulo de la cabeza.
  const perp = { x: -dir.y, y: dir.x };
  const baseX = headX - dir.x * headSize * 1.6;
  const baseY = headY - dir.y * headSize * 1.6;

  const labelX = tailX + dir.x * (length + unitSize * 0.6);
  const labelY = tailY + dir.y * (length + unitSize * 0.6);

  return (
    <g className={COLOR_CLASS[variant]}>
      <line x1={tailX} y1={tailY} x2={headX} y2={headY} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {/* La punta y la etiqueta son macizas: sin `stroke-none` heredan el color
          del grupo con el ancho inicial (1 unidad del modelo, no 1 px). */}
      <polygon
        points={`${headX},${headY} ${baseX + perp.x * headSize},${baseY + perp.y * headSize} ${baseX - perp.x * headSize},${baseY - perp.y * headSize}`}
        className="stroke-none"
      />
      <text
        x={labelX}
        y={labelY}
        fontSize={unitSize}
        textAnchor="middle"
        dominantBaseline="middle"
        className="stroke-none"
      >
        {value.toFixed(decimals)}
      </text>
    </g>
  );
}
