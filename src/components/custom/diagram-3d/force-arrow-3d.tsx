"use client";

import { useAtom } from "jotai";
import { Html } from "@react-three/drei";

import { atomDecimals } from "@/components/custom/decimals";
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
}

/**
 * Flecha recta sobre un eje coordenado: vástago cilíndrico desde el nudo hacia
 * afuera, punta cónica y el valor como etiqueta DOM. Igual que en 2D, una
 * flecha de valor exactamente cero no se dibuja — evita el ruido de las
 * reacciones nulas.
 */
export function ForceArrow3D({ origin, axis, value, unitSize, variant, color }: ForceArrow3DProps) {
  const [decimals] = useAtom(atomDecimals);
  if (value === 0) return null;

  const sign: 1 | -1 = value >= 0 ? 1 : -1;
  const direction = unitVector(axis, sign);
  const rotation = rotationForAxis(axis, sign);

  const length = unitSize * 2.2;
  const headHeight = unitSize * 0.7;
  const shaftLength = Math.max(length - headHeight, unitSize * 0.2);

  const shaftCenter = translate(origin, direction, shaftLength / 2);
  const headCenter = translate(origin, direction, shaftLength + headHeight / 2);
  const labelAt = translate(origin, direction, length + unitSize * 0.9);

  return (
    <group>
      <mesh position={shaftCenter} rotation={rotation}>
        <cylinderGeometry args={[unitSize * 0.09, unitSize * 0.09, shaftLength, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={headCenter} rotation={rotation}>
        <coneGeometry args={[unitSize * 0.26, headHeight, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={labelAt} center style={{ pointerEvents: "none" }}>
        <span
          className="whitespace-nowrap rounded bg-background/80 px-1 text-[10px] tabular-nums"
          style={{ color: `#${color.toString(16).padStart(6, "0")}` }}
          data-variant={variant}
        >
          {value.toFixed(decimals)}
        </span>
      </Html>
    </group>
  );
}
