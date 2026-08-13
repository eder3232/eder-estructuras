"use client";

import { useDecimals } from "@/components/custom/decimals-scope";
import { DiagramLabel } from "./diagram-label";
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

  // La etiqueta nunca se apoya sobre el eje de la flecha: arranca al lado de la
  // punta y crece hacia afuera.
  //
  // Antes iba centrada un poco más allá de la punta, y eso fallaba de dos
  // maneras a la vez. Centrada, la mitad del número quedaba *detrás* del punto
  // de anclaje, o sea encima de su propia cabeza de flecha ("4.8000" con la
  // punta clavada entre el 4 y el 8, en el nudo v3 del esquema semilla). Y
  // sobre el eje, una flecha vertical apoya el número justo sobre la barra
  // vertical que sale del nudo, que es el caso más común en una armadura.
  //
  // Las horizontales se corren a lo largo de su dirección, se anclan por el
  // extremo que toca la punta y bajan medio renglón; las verticales se corren
  // al costado, que es la única salida que las despega de la barra.
  //
  // El medio renglón hacia abajo no es cosmético: los nombres de barra del
  // esquema van *arriba* de su barra (`y - 0.4·unit`), así que una carga
  // horizontal sobre un cordón —el caso del nudo v3— dejaba el número pegado al
  // nombre. Debajo del eje no hay nada más compitiendo.
  const gap = unitSize * 0.55;
  const label =
    axis === "x"
      ? {
          x: headX + dir.x * gap,
          y: headY + unitSize * 0.6,
          anchor: dir.x > 0 ? ("start" as const) : ("end" as const),
        }
      : { x: headX + gap, y: headY, anchor: "start" as const };

  return (
    <g className={COLOR_CLASS[variant]}>
      <line x1={tailX} y1={tailY} x2={headX} y2={headY} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {/* La punta y la etiqueta son macizas: sin `stroke-none` heredan el color
          del grupo con el ancho inicial (1 unidad del modelo, no 1 px). */}
      <polygon
        points={`${headX},${headY} ${baseX + perp.x * headSize},${baseY + perp.y * headSize} ${baseX - perp.x * headSize},${baseY - perp.y * headSize}`}
        className="stroke-none"
      />
      <DiagramLabel x={label.x} y={label.y} unitSize={unitSize} anchor={label.anchor}>
        {value.toFixed(decimals)}
      </DiagramLabel>
    </g>
  );
}
