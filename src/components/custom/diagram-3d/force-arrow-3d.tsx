"use client";

import { Html } from "@react-three/drei";

import { useDecimals } from "@/components/custom/decimals-scope";
import { rotationForAxis, translate, unitVector } from "./orientation";
import type { Diagram3DAxis, Point3 } from "./types";

interface ForceArrow3DProps {
  origin: Point3;
  axis: Diagram3DAxis;
  value: number;
  unitSize: number;
  /** "force" = carga aplicada; "reaction" = reacción calculada — mismo criterio de color que el módulo 2D. */
  variant: "force" | "reaction";
  color: number;
  /**
   * `false` para dibujar la flecha sin su número. Las reacciones de un apoyo se
   * rotulan juntas con `NodeForceLabel`: con una etiqueta por eje, las tres de
   * un mismo nudo caían una encima de la otra en la vista isométrica.
   */
  label?: boolean;
  /** Menos de 1 para atenuarla cuando se señala otra parte del modelo (N3). */
  opacity?: number;
}

/**
 * Lo que a los decimales actuales se lee como cero no se dibuja. Comparar con
 * `=== 0` dejaba pasar el ruido numérico del solver, y la escena mostraba una
 * flecha con `-0.0000`.
 */
export function readsAsZero(value: number, decimals: number): boolean {
  return Math.abs(value) < 0.5 * 10 ** -decimals;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * Flecha recta sobre un eje coordenado: vástago cilíndrico desde el nudo hacia
 * afuera, punta cónica y el valor como etiqueta DOM. Igual que en 2D, una
 * flecha de valor exactamente cero no se dibuja — evita el ruido de las
 * reacciones nulas.
 */
export function ForceArrow3D({
  origin,
  axis,
  value,
  unitSize,
  variant,
  color,
  label = true,
  opacity = 1,
}: ForceArrow3DProps) {
  const decimals = useDecimals();
  if (readsAsZero(value, decimals)) return null;

  const sign: 1 | -1 = value >= 0 ? 1 : -1;
  const direction = unitVector(axis, sign);
  const rotation = rotationForAxis(axis, sign);

  // Más larga que en 2D: con la cámara en perspectiva y lejos, a `2.2` la
  // flecha medía un 5% de la figura y no se veía.
  const length = unitSize * 5;
  const headHeight = unitSize * 1.2;
  const shaftLength = Math.max(length - headHeight, unitSize * 0.2);

  const shaftCenter = translate(origin, direction, shaftLength / 2);
  const headCenter = translate(origin, direction, shaftLength + headHeight / 2);
  const labelAt = translate(origin, direction, length + unitSize * 0.9);

  return (
    <group>
      <mesh position={shaftCenter} rotation={rotation}>
        <cylinderGeometry args={[unitSize * 0.14, unitSize * 0.14, shaftLength, 10]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={headCenter} rotation={rotation}>
        <coneGeometry args={[unitSize * 0.4, headHeight, 12]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {label && (
        <Html position={labelAt} center style={{ pointerEvents: "none", opacity }}>
          <span
            className="whitespace-nowrap rounded bg-background/80 px-1 text-xs tabular-nums"
            style={{ color: hex(color) }}
            data-variant={variant}
          >
            {value.toFixed(decimals)}
          </span>
        </Html>
      )}
    </group>
  );
}

/**
 * Las componentes de fuerza de un nudo en una sola etiqueta, una por renglón
 * (`Rx = −2.8571`). Va debajo del nudo, que es donde están los apoyos: arriba
 * suelen llegar las barras. Las componentes que se leen como cero no se
 * listan; si no queda ninguna, no hay etiqueta.
 */
export function NodeForceLabel({
  origin,
  components,
  symbol,
  unitSize,
  color,
}: {
  origin: Point3;
  components: { axis: Diagram3DAxis; value: number }[];
  /** La letra de la magnitud: `R` para reacciones. */
  symbol: string;
  unitSize: number;
  color: number;
}) {
  const decimals = useDecimals();
  const visible = components.filter((c) => !readsAsZero(c.value, decimals));
  if (visible.length === 0) return null;

  return (
    <Html position={[origin[0], origin[1], origin[2] - unitSize * 3]} center style={{ pointerEvents: "none" }}>
      <span
        className="flex flex-col whitespace-nowrap rounded bg-background/80 px-1 text-xs tabular-nums"
        style={{ color: hex(color) }}
      >
        {visible.map((c) => (
          <span key={c.axis}>
            {symbol}
            <sub>{c.axis}</sub> = {c.value.toFixed(decimals)}
          </span>
        ))}
      </span>
    </Html>
  );
}
